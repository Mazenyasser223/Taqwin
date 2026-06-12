/* eslint-disable no-console */
/**
 * Block B8 — Ingest L5 (coaching books) into Postgres pgvector.
 *
 * Sources:
 *   - data/coaching-book (markdown)
 *   - data/books (markdown, recursive)
 *
 *   node scripts/rag/ingest-l5-books.js
 *   node scripts/rag/ingest-l5-books.js --dry-run
 *   node scripts/rag/ingest-l5-books.js --skip-embed
 */
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Set DIRECT_URL or DATABASE_URL in backend-node/.env');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const {
  parseFrontmatter,
  chunkByHeading,
  mergeSmallSections,
  collectMarkdownFiles,
  approxTokens,
} = require('../lib/markdownIngest');
const {
  purgeLevel,
  embedChunkRows,
  providerInfo,
  isEmbeddingsConfigured,
} = require('../lib/pgvectorIngest');

const L5_LEVEL = 'L5_BOOKS';
const SOURCE_PREFIX = 'l5:';

const args = process.argv.slice(2);
const argSet = new Set(args);
const dryRun = argSet.has('--dry-run');
const skipEmbed = argSet.has('--skip-embed');
const DATA_DIRS = [
  { dir: path.join(__dirname, '..', '..', 'data', 'coaching-book'), prefix: 'coaching-book' },
  { dir: path.join(__dirname, '..', '..', 'data', 'books'), prefix: 'books' },
];

function stableSourceKey(relativePath) {
  return `${SOURCE_PREFIX}${relativePath.replace(/\\/g, '/')}`;
}

/** Postgres text columns reject NUL (0x00) bytes from PDF extraction. */
function sanitizeText(text) {
  return String(text || '')
    .replace(/\u0000/g, '')
    .trim();
}

function collectBookFiles() {
  const out = [];
  for (const { dir, prefix } of DATA_DIRS) {
    out.push(...collectMarkdownFiles(dir, { prefix }));
  }
  return out;
}

function extractSectionsFromMarkdown(absPath, sourceFile) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const topic = sanitizeText(meta.topic || path.basename(sourceFile, '.md'));
  const locale = meta.locale || meta.lang || 'en';
  const tags = Array.isArray(meta.tags) ? meta.tags : [];

  let sections = chunkByHeading(sanitizeText(body));
  if (!sections.length && sanitizeText(body).length >= 80) {
    sections = [{ title: topic, text: sanitizeText(body) }];
  }
  sections = mergeSmallSections(
    sections.map((s) => ({
      title: sanitizeText(s.title),
      text: sanitizeText(s.text),
    }))
  );

  return {
    title: topic,
    locale,
    tags,
    meta,
    sections,
    bookId: meta.book || null,
    chapter: meta.chapter != null ? Number(meta.chapter) : null,
  };
}

async function deleteDocumentBySource(source) {
  const existing = await prisma.knowledgeDocument.findFirst({
    where: { source, level: L5_LEVEL },
    select: { id: true },
  });
  if (!existing) return;
  await prisma.knowledgeChunk.deleteMany({ where: { documentId: existing.id } });
  await prisma.knowledgeDocument.delete({ where: { id: existing.id } });
}

async function ingestDocument({ sourceFile, title, locale, storagePath, docMeta, sections }) {
  const source = stableSourceKey(sourceFile);

  if (!sections.length) {
    console.log(`  - ${sourceFile}: no chunks extracted`);
    return { chunks: 0, embedded: 0 };
  }

  if (dryRun) {
    console.log(`  [dry-run] ${sourceFile}: ${sections.length} chunk(s)`);
    return { chunks: sections.length, embedded: 0 };
  }

  await deleteDocumentBySource(source);

  const doc = await prisma.knowledgeDocument.create({
    data: {
      level: L5_LEVEL,
      source,
      title,
      locale,
      storagePath,
      metadata: docMeta,
    },
  });

  const chunkRows = [];
  for (const section of sections) {
    const content = section.title ? `# ${section.title}\n\n${section.text}` : section.text;
    const chunk = await prisma.knowledgeChunk.create({
      data: {
        documentId: doc.id,
        content,
        metadata: {
          level: L5_LEVEL,
          topic: section.title || title,
          tags: docMeta.tags || [],
          sourceFile,
          tokens: approxTokens(content),
          bookId: docMeta.bookId ?? null,
          chapter: docMeta.chapter ?? null,
        },
      },
    });
    chunkRows.push({ id: chunk.id, content });
  }

  let embedded = 0;
  if (!skipEmbed && chunkRows.length && isEmbeddingsConfigured()) {
    embedded = await embedChunkRows(prisma, chunkRows, { skipEmbed });
  } else if (!skipEmbed && chunkRows.length) {
    console.warn(`  ! ${sourceFile}: no embeddings provider — vectors skipped`);
  }

  console.log(
    `  + ${sourceFile}: ${chunkRows.length} chunk(s)` +
      (skipEmbed ? ' (embed skipped)' : `, embedded=${embedded}`)
  );
  return { chunks: chunkRows.length, embedded };
}

async function ingestFromFiles() {
  const files = collectBookFiles();
  if (!files.length) {
    console.warn('No markdown book files found under data/coaching-book or data/books.');
    return { files: new Set(), totalChunks: 0, totalEmbedded: 0 };
  }

  const ingestedFiles = new Set();
  let totalChunks = 0;
  let totalEmbedded = 0;

  for (const f of files) {
    const parsed = extractSectionsFromMarkdown(f.abs, f.sourceFile);
    const r = await ingestDocument({
      sourceFile: f.sourceFile,
      title: parsed.title,
      locale: parsed.locale,
      storagePath: f.sourceFile,
      docMeta: {
        tags: parsed.tags,
        bookId: parsed.bookId,
        chapter: parsed.chapter,
        ...parsed.meta,
      },
      sections: parsed.sections,
    });
    ingestedFiles.add(f.sourceFile);
    totalChunks += r.chunks;
    totalEmbedded += r.embedded;
  }

  return { files: ingestedFiles, totalChunks, totalEmbedded };
}

async function main() {
  console.log('Block B8 — L5 book ingest → Postgres knowledge_documents / knowledge_chunks');
  if (dryRun) console.log('(dry-run — no writes)\n');
  if (skipEmbed) console.log('(--skip-embed)\n');

  if (!dryRun) {
    const purged = await purgeLevel(prisma, L5_LEVEL);
    if (purged) console.log(`Purged ${purged} previous L5 document(s).\n`);
  }

  const fileResult = await ingestFromFiles();

  if (dryRun) {
    console.log(`\n[dry-run] Would ingest ~${fileResult.totalChunks} chunk(s) from files.`);
    process.exit(0);
  }

  const counts = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM knowledge_documents WHERE level = 'L5_BOOKS') AS docs,
      (SELECT COUNT(*)::int FROM knowledge_chunks k
        JOIN knowledge_documents d ON d.id = k.document_id
        WHERE d.level = 'L5_BOOKS') AS chunks,
      (SELECT COUNT(*)::int FROM knowledge_chunks k
        JOIN knowledge_documents d ON d.id = k.document_id
        WHERE d.level = 'L5_BOOKS' AND k.embedding IS NOT NULL) AS embedded
  `;
  const { docs, chunks, embedded } = counts[0];
  console.log(`\nL5 totals: ${docs} documents, ${chunks} chunks (${embedded} with embeddings).`);
  console.log(
    `This run: files +${fileResult.totalChunks} chunks (+${fileResult.totalEmbedded} embedded)`
  );
}

main()
  .catch((err) => {
    console.error('Ingest failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
