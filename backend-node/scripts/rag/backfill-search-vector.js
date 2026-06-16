/* eslint-disable no-console */
/**
 * Backfill knowledge_chunks.search_vector for hybrid keyword search.
 *
 *   node scripts/rag/backfill-search-vector.js
 */
require('dotenv').config();

const { getPrisma, buildSearchText, setChunkSearchVector } = require('../lib/pgvectorIngest');

async function main() {
  const prisma = getPrisma();
  const rows = await prisma.knowledgeChunk.findMany({
    select: { id: true, content: true, metadata: true },
  });
  console.log(`Backfilling search_vector for ${rows.length} chunk(s)...`);
  let updated = 0;
  for (const row of rows) {
    await setChunkSearchVector(prisma, row.id, row.content, row.metadata || {});
    updated += 1;
    if (updated % 500 === 0) console.log(`  ${updated}/${rows.length}`);
  }
  console.log(`Done. Updated ${updated} chunk(s).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
