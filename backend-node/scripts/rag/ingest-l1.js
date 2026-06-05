/* eslint-disable no-console */
/**
 * Block B2 — Ingest L1 (Taqwin internal docs + book library structure) into Postgres pgvector.
 *
 *   node scripts/rag/ingest-l1.js
 *   node scripts/rag/ingest-l1.js --skip-embed   # chunks without vectors (dev)
 *   node scripts/rag/ingest-l1.js --dry-run
 *
 * Sources:
 *   - data/knowledge/l1/*.md
 *   - auto-generated book catalog from data/books BOOK_ID _meta.yaml files
 *
 * Note: Full book chapters live in L5 (Block B8 — rag:ingest:l5), not L1.
 *
 * Requires DIRECT_URL or DATABASE_URL. Embeddings require OPENAI_API_KEY or VOYAGE_API_KEY
 * (1536-dim models only — Ollama 768-dim is rejected unless RAG_EMBED_DIMS is changed).
 */
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const {
  parseFrontmatter,
  chunkByHeading,
  mergeSmallSections,
  collectMarkdownFiles,
  collectBookCatalogEntries,
  buildBookCatalogMarkdown,
  approxTokens,
} = require('../lib/markdownIngest');
const {
  isEmbeddingsConfigured,
  providerInfo,
} = require('../../src/services/embeddingsProvider');
const {
  getEmbedBatchSize,
  getEmbedDelayMs,
  sleep,
  embedBatchWithRetry,
} = require('../lib/embedBatch');

const EMBED_DIMS = Number(process.env.RAG_EMBED_DIMS || 1536);
const BATCH = getEmbedBatchSize(Number(process.env.RAG_INGEST_BATCH || 16));
const EMBED_DELAY_MS = getEmbedDelayMs();
const L1_LEVEL = 'L1_INTERNAL';
const SOURCE_PREFIX = 'l1:';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Set DIRECT_URL or DATABASE_URL in backend-node/.env');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const args = new Set(process.argv.slice(2));
const skipEmbed = args.has('--skip-embed');
const dryRun = args.has('--dry-run');

function stableSourceKey(relativePath) {
  return `${SOURCE_PREFIX}${relativePath.replace(/\\/g, '/')}`;
}

function toVectorLiteral(arr) {
  return `[${arr.map((n) => Number(n).toFixed(8)).join(',')}]`;
}

function padVector(vector, dims = EMBED_DIMS) {
  if (!vector || !vector.length) return vector;
  if (vector.length === dims) return vector;
  if (vector.length > dims) {
    throw new Error(`Embedding dim ${vector.length} exceeds pgvector column ${dims}`);
  }
  return vector.concat(Array(dims - vector.length).fill(0));
}

function buildIngestSources() {
  const root = path.join(__dirname, '..', '..');
  const sources = [];

  const l1Dir = path.join(root, 'data', 'knowledge', 'l1');
  for (const f of collectMarkdownFiles(l1Dir, { prefix: 'knowledge/l1' })) {
    sources.push({ type: 'markdown', ...f });
  }

  const catalog = collectBookCatalogEntries(path.join(root, 'data', 'books'));
  if (catalog.length) {
    sources.push({
      type: 'catalog',
      sourceFile: 'knowledge/l1/_generated-book-catalog.md',
      body: buildBookCatalogMarkdown(catalog),
      meta: { topic: 'Taqwin book library catalog', tags: ['platform', 'books', 'catalog', 'bls'], lang: 'en', locale: 'en' },
    });
  }

  return sources;
}

function extractChunksFromMarkdown(absPath, sourceFile) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const topic = meta.topic || path.basename(sourceFile, '.md');
  const locale = meta.locale || meta.lang || 'en';
  const tags = Array.isArray(meta.tags) ? meta.tags : [];

  let sections = chunkByHeading(body);
  if (!sections.length && body.trim().length >= 80) {
    sections = [{ title: topic, text: body.trim() }];
  }
  sections = mergeSmallSections(sections);

  return {
    title: topic,
    locale,
    tags,
    meta,
    sections,
  };
}

async function deleteDocumentBySource(source) {
  const existing = await prisma.knowledgeDocument.findFirst({
    where: { source, level: L1_LEVEL },
    select: { id: true },
  });
  if (existing) {
    await prisma.knowledgeChunk.deleteMany({ where: { documentId: existing.id } });
    await prisma.knowledgeDocument.delete({ where: { id: existing.id } });
  }
}

async function setChunkEmbedding(chunkId, vector) {
  const padded = padVector(vector);
  if (!padded || padded.length !== EMBED_DIMS) {
    throw new Error(`Expected ${EMBED_DIMS}-dim embedding, got ${vector?.length ?? 0}`);
  }
  const lit = toVectorLiteral(padded);
  await prisma.$executeRawUnsafe(
    `UPDATE knowledge_chunks SET embedding = '${lit}'::vector WHERE id = '${chunkId}'`
  );
}

async function ingestDocument({ sourceFile, title, locale, storagePath, docMeta, sections }) {
  const source = stableSourceKey(sourceFile);

  if (dryRun) {
    console.log(`  [dry-run] ${sourceFile}: ${sections.length} chunk(s)`);
    return { chunks: sections.length, embedded: 0 };
  }

  await deleteDocumentBySource(source);

  const doc = await prisma.knowledgeDocument.create({
    data: {
      level: L1_LEVEL,
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
    const row = await prisma.knowledgeChunk.create({
      data: {
        documentId: doc.id,
        content,
        metadata: {
          topic: section.title || title,
          tags: docMeta.tags || [],
          sourceFile,
          level: L1_LEVEL,
          tokens: approxTokens(content),
        },
      },
    });
    chunkRows.push({ id: row.id, content });
  }

  let embedded = 0;
  if (!skipEmbed && chunkRows.length) {
    if (!isEmbeddingsConfigured()) {
      console.warn('  ! No embeddings provider — chunks saved without vectors. Use --skip-embed or set OPENAI_API_KEY.');
    } else {
      const { model } = providerInfo();
      const batchSize = BATCH;

      for (let i = 0; i < chunkRows.length; i += batchSize) {
        if (i > 0 && EMBED_DELAY_MS > 0) await sleep(EMBED_DELAY_MS);
        const slice = chunkRows.slice(i, i + batchSize);
        const texts = slice.map((c) => c.content);
        const vectors = await embedBatchWithRetry(texts);
        if (!vectors || !vectors.length) {
          throw new Error('Embedding provider returned no vectors');
        }
        for (let j = 0; j < slice.length; j += 1) {
          await setChunkEmbedding(slice[j].id, vectors[j]);
          embedded += 1;
        }
      }
      console.log(`  + ${sourceFile}: ${chunkRows.length} chunk(s), embedded=${embedded}, model=${model}`);
      return { chunks: chunkRows.length, embedded };
    }
  }

  console.log(`  + ${sourceFile}: ${chunkRows.length} chunk(s)${skipEmbed ? ' (embed skipped)' : ''}`);
  return { chunks: chunkRows.length, embedded };
}

async function main() {
  console.log('Block B2 — L1 ingest → Postgres knowledge_documents / knowledge_chunks');
  if (dryRun) console.log('(dry-run mode — no writes)\n');
  if (skipEmbed) console.log('(--skip-embed — vectors not written)\n');

  const sources = buildIngestSources();
  if (!sources.length) {
    console.error('No L1 sources found. Add markdown under data/knowledge/l1/');
    process.exit(1);
  }

  let totalChunks = 0;
  let totalEmbedded = 0;

  for (const src of sources) {
    if (src.type === 'catalog') {
      let sections = chunkByHeading(src.body);
      if (!sections.length) {
        sections = [{ title: src.meta.topic, text: src.body.trim() }];
      }
      sections = mergeSmallSections(sections);
      const r = await ingestDocument({
        sourceFile: src.sourceFile,
        title: src.meta.topic,
        locale: src.meta.locale || 'en',
        storagePath: src.sourceFile,
        docMeta: { tags: src.meta.tags, generated: true },
        sections,
      });
      totalChunks += r.chunks;
      totalEmbedded += r.embedded;
      continue;
    }

    const parsed = extractChunksFromMarkdown(src.abs, src.sourceFile);
    const r = await ingestDocument({
      sourceFile: src.sourceFile,
      title: parsed.title,
      locale: parsed.locale,
      storagePath: src.sourceFile,
      docMeta: { tags: parsed.tags, ...parsed.meta },
      sections: parsed.sections,
    });
    totalChunks += r.chunks;
    totalEmbedded += r.embedded;
  }

  if (!dryRun) {
    const counts = await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM knowledge_documents WHERE level = 'L1_INTERNAL') AS docs,
        (SELECT COUNT(*)::int FROM knowledge_chunks k
          JOIN knowledge_documents d ON d.id = k.document_id
          WHERE d.level = 'L1_INTERNAL') AS chunks,
        (SELECT COUNT(*)::int FROM knowledge_chunks k
          JOIN knowledge_documents d ON d.id = k.document_id
          WHERE d.level = 'L1_INTERNAL' AND k.embedding IS NOT NULL) AS embedded
    `;
    const { docs, chunks, embedded } = counts[0];
    console.log(`\nL1 totals: ${docs} documents, ${chunks} chunks (${embedded} with embeddings).`);
    console.log(`This run: +${totalChunks} chunks, +${totalEmbedded} embedded.`);
  } else {
    console.log(`\n[dry-run] Would ingest ~${totalChunks} chunks from ${sources.length} source(s).`);
  }
}

main()
  .catch((err) => {
    console.error('Ingest failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
