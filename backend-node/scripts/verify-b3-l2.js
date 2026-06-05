/* eslint-disable no-console */
/**
 * Block B3 verification — L2 exercise chunks in Postgres pgvector.
 *
 *   node scripts/verify-b3-l2.js
 */
require('dotenv').config();
const { getPrisma } = require('./lib/pgvectorIngest');

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function main() {
  const prisma = getPrisma();
  console.log('Block B3 — L2 exercise ingest verification');
  console.log(`DB: ${dbUrl.replace(/:[^:@/]+@/, ':***@').replace(/\?(.*)$/, '')}\n`);

  let failed = false;

  const exerciseCount = await prisma.exercise.count({ where: { isPublic: true } });
  console.log(`Public exercises in catalog: ${exerciseCount}`);

  const docs = await prisma.knowledgeDocument.count({ where: { level: 'L2_EXERCISE' } });
  const counts = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS chunks,
      COUNT(*) FILTER (WHERE k.embedding IS NOT NULL)::int AS embedded
    FROM knowledge_chunks k
    JOIN knowledge_documents d ON d.id = k.document_id
    WHERE d.level = 'L2_EXERCISE'
  `;
  const { chunks, embedded } = counts[0];

  if (!docs) {
    console.error('✗ No L2_EXERCISE documents — run: npm run rag:ingest:l2');
    failed = true;
  } else {
    console.log(`✓ ${docs} L2 document(s), ${chunks} chunk(s), ${embedded} embedded`);
  }

  if (docs > 0 && docs < exerciseCount * 0.9) {
    console.warn(`  ⚠ L2 docs (${docs}) < 90% of public exercises (${exerciseCount}) — partial ingest?`);
  }

  const requireEmbed = (process.env.RAG_B3_REQUIRE_EMBED || 'true').toLowerCase() !== 'false';
  if (requireEmbed && chunks > 0 && embedded < chunks) {
    console.error(`✗ Only ${embedded}/${chunks} chunks embedded — run: npm run rag:embed:l2`);
    failed = true;
  } else if (requireEmbed && chunks > 0 && embedded === 0) {
    console.error('✗ Chunks exist but none embedded — check OPENAI_API_KEY and re-run ingest');
    failed = true;
  }

  if (embedded > 0) {
    const sample = await prisma.$queryRaw`
      SELECT d.title, (k.metadata->>'exerciseId') AS exercise_id, LEFT(k.content, 100) AS preview
      FROM knowledge_chunks k
      JOIN knowledge_documents d ON d.id = k.document_id
      WHERE d.level = 'L2_EXERCISE' AND k.embedding IS NOT NULL
      LIMIT 1
    `;
    if (sample.length) {
      console.log(`\nSample: [${sample[0].title}] exerciseId=${sample[0].exercise_id}`);
      console.log(`  ${sample[0].preview}…`);
    }
  }

  console.log(failed ? '\nFAILED' : '\nBlock B3 verification passed.');
  if (failed) process.exit(1);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
