/* eslint-disable no-console */
/**
 * Block B4 verification — L3 nutrition chunks in Postgres pgvector.
 *
 *   node scripts/verify-b4-l3.js
 */
require('dotenv').config();
const { getPrisma } = require('./lib/pgvectorIngest');

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

async function main() {
  const prisma = getPrisma();
  console.log('Block B4 — L3 food ingest verification');
  console.log(`DB: ${dbUrl.replace(/:[^:@/]+@/, ':***@').replace(/\?(.*)$/, '')}\n`);

  let failed = false;

  const [foodItemCount, webtebCount] = await Promise.all([
    prisma.foodItem.count({ where: { isPublic: true } }),
    prisma.webtebFood.count(),
  ]);
  console.log(`Catalog: ${foodItemCount} public FoodItem(s), ${webtebCount} WebtebFood(s)`);

  const docs = await prisma.knowledgeDocument.count({ where: { level: 'L3_NUTRITION' } });
  const bySource = await prisma.$queryRaw`
    SELECT
      CASE
        WHEN d.source LIKE 'l3:foodItem:%' THEN 'foodItem'
        WHEN d.source LIKE 'l3:webteb:%' THEN 'webteb'
        ELSE 'other'
      END AS src,
      COUNT(*)::int AS n
    FROM knowledge_documents d
    WHERE d.level = 'L3_NUTRITION'
    GROUP BY 1
    ORDER BY 1
  `;

  const counts = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS chunks,
      COUNT(*) FILTER (WHERE k.embedding IS NOT NULL)::int AS embedded
    FROM knowledge_chunks k
    JOIN knowledge_documents d ON d.id = k.document_id
    WHERE d.level = 'L3_NUTRITION'
  `;
  const { chunks, embedded } = counts[0];

  if (!docs) {
    console.error('✗ No L3_NUTRITION documents — run: npm run rag:ingest:l3');
    failed = true;
  } else {
    console.log(`✓ ${docs} L3 document(s), ${chunks} chunk(s), ${embedded} embedded`);
    for (const row of bySource) console.log(`    ${row.src}: ${row.n}`);
  }

  const requireEmbed = (process.env.RAG_B4_REQUIRE_EMBED || 'true').toLowerCase() !== 'false';
  if (requireEmbed && chunks > 0 && embedded < chunks) {
    console.error(`✗ Only ${embedded}/${chunks} embedded — run: npm run rag:embed:l3`);
    failed = true;
  }

  if (embedded > 0) {
    const sample = await prisma.$queryRaw`
      SELECT d.title, k.metadata->>'foodSource' AS src, LEFT(k.content, 100) AS preview
      FROM knowledge_chunks k
      JOIN knowledge_documents d ON d.id = k.document_id
      WHERE d.level = 'L3_NUTRITION' AND k.embedding IS NOT NULL
      LIMIT 1
    `;
    if (sample.length) {
      console.log(`\nSample [${sample[0].src}]: ${sample[0].title}`);
      console.log(`  ${sample[0].preview}…`);
    }
  }

  console.log(failed ? '\nFAILED' : '\nBlock B4 verification passed.');
  if (failed) process.exit(1);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
