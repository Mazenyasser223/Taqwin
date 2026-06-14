/* eslint-disable no-console */
/**
 * Block B8 verification — L5 book chunks in Postgres pgvector.
 *
 *   node scripts/verify-b8-l5.js
 */
require('dotenv').config();
const { getPrisma } = require('./lib/pgvectorIngest');

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function main() {
  const prisma = getPrisma();
  console.log('Block B8 — L5 book ingest verification');
  console.log(`DB: ${dbUrl.replace(/:[^:@/]+@/, ':***@').replace(/\?(.*)$/, '')}\n`);

  let failed = false;

  const path = require('path');
  const { collectMarkdownFiles } = require('./lib/markdownIngest');

  const bookFiles = collectMarkdownFiles(path.join(__dirname, '..', 'data', 'books'), {
    prefix: 'books',
  });
  const coachingFiles = collectMarkdownFiles(path.join(__dirname, '..', 'data', 'coaching-book'), {
    prefix: 'coaching-book',
  });
  const expectedFiles = bookFiles.length + coachingFiles.length;
  console.log(`Markdown sources on disk: ${expectedFiles} file(s) (books + coaching-book)`);

  const docs = await prisma.knowledgeDocument.count({ where: { level: 'L5_BOOKS' } });
  const byBook = await prisma.$queryRaw`
    SELECT
      COALESCE(d.metadata->>'bookId', 'unknown') AS book_id,
      COUNT(*)::int AS n
    FROM knowledge_documents d
    WHERE d.level = 'L5_BOOKS'
    GROUP BY 1
    ORDER BY 1
  `;

  const counts = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS chunks,
      COUNT(*) FILTER (WHERE k.embedding IS NOT NULL)::int AS embedded
    FROM knowledge_chunks k
    JOIN knowledge_documents d ON d.id = k.document_id
    WHERE d.level = 'L5_BOOKS'
      AND k.chunk_role IN ('child', 'standalone')
  `;
  const { chunks, embedded } = counts[0];

  if (!docs) {
    console.error('✗ No L5_BOOKS documents — run: npm run rag:ingest:l5');
    failed = true;
  } else {
    console.log(`✓ ${docs} L5 document(s), ${chunks} chunk(s), ${embedded} embedded`);
    for (const row of byBook) console.log(`    ${row.book_id}: ${row.n} doc(s)`);
  }

  if (expectedFiles > 0 && docs < expectedFiles) {
    console.warn(`  ⚠ L5 docs (${docs}) < markdown files (${expectedFiles}) — partial ingest?`);
  }

  const requireEmbed = (process.env.RAG_B8_REQUIRE_EMBED || 'true').toLowerCase() !== 'false';
  if (requireEmbed && chunks > 0 && embedded < chunks) {
    console.error(`✗ Only ${embedded}/${chunks} embedded — run: npm run rag:embed:l5`);
    failed = true;
  }

  if (embedded > 0) {
    const sample = await prisma.$queryRaw`
      SELECT d.title, k.metadata->>'sourceFile' AS src, LEFT(k.content, 120) AS preview
      FROM knowledge_chunks k
      JOIN knowledge_documents d ON d.id = k.document_id
      WHERE d.level = 'L5_BOOKS' AND k.embedding IS NOT NULL
      LIMIT 1
    `;
    if (sample.length) {
      console.log(`\nSample: [${sample[0].title}] ${sample[0].src}`);
      console.log(`  ${sample[0].preview}…`);
    }
  }

  console.log(failed ? '\nFAILED' : '\nBlock B8 verification passed.');
  if (failed) process.exit(1);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
