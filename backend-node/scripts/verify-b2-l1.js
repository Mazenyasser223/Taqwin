/* eslint-disable no-console */
/**
 * Block B2 verification — L1 documents and chunks in Postgres.
 *
 *   node scripts/verify-b2-l1.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Set DIRECT_URL or DATABASE_URL in backend-node/.env');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

async function main() {
  console.log('Block B2 — L1 ingest verification');
  console.log(`DB: ${dbUrl.replace(/:[^:@/]+@/, ':***@').replace(/\?(.*)$/, '')}\n`);

  let failed = false;

  const docs = await prisma.knowledgeDocument.findMany({
    where: { level: 'L1_INTERNAL' },
    select: { id: true, source: true, title: true, locale: true },
    orderBy: { source: 'asc' },
  });

  if (!docs.length) {
    console.error('✗ No L1_INTERNAL documents — run: npm run rag:ingest:l1');
    failed = true;
  } else {
    console.log(`✓ ${docs.length} L1 document(s):`);
    for (const d of docs) console.log(`    • ${d.source} — ${d.title}`);
  }

  const counts = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS chunks,
      COUNT(*) FILTER (WHERE k.embedding IS NOT NULL)::int AS embedded
    FROM knowledge_chunks k
    JOIN knowledge_documents d ON d.id = k.document_id
    WHERE d.level = 'L1_INTERNAL'
  `;
  const { chunks, embedded } = counts[0];
  console.log(`\n✓ ${chunks} L1 chunk(s), ${embedded} with embeddings`);

  if (chunks === 0) {
    console.error('✗ No L1 chunks');
    failed = true;
  }

  const requireEmbed = (process.env.RAG_B2_REQUIRE_EMBED || 'true').toLowerCase() !== 'false';
  if (requireEmbed && embedded === 0 && chunks > 0) {
    console.error('✗ Chunks exist but none embedded — set OPENAI_API_KEY and re-run npm run rag:ingest:l1');
    failed = true;
  } else if (embedded > 0) {
    const sample = await prisma.$queryRaw`
      SELECT k.id, d.title, LEFT(k.content, 80) AS preview
      FROM knowledge_chunks k
      JOIN knowledge_documents d ON d.id = k.document_id
      WHERE d.level = 'L1_INTERNAL' AND k.embedding IS NOT NULL
      LIMIT 1
    `;
    if (sample.length) {
      console.log(`\nSample chunk: [${sample[0].title}] ${sample[0].preview}…`);
    }
  }

  console.log(failed ? '\nFAILED' : '\nBlock B2 verification passed.');
  if (failed) process.exit(1);
}

main()
  .catch((err) => {
    console.error('FAIL:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
