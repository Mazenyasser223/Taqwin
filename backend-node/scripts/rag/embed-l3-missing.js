/* eslint-disable no-console */
/**
 * Embed missing L3 food vectors (resume after interrupted B4 ingest).
 *
 *   node scripts/rag/embed-l3-missing.js
 */
require('dotenv').config();

const { getPrisma, embedChunkRows, providerInfo, isEmbeddingsConfigured } = require('../lib/pgvectorIngest');

async function main() {
  if (!isEmbeddingsConfigured()) {
    console.error('No embeddings provider configured.');
    process.exit(1);
  }

  const prisma = getPrisma();
  const { model } = providerInfo();
  console.log(`Block B4 resume — embed missing L3 chunks (${model})`);

  const pending = await prisma.$queryRaw`
    SELECT k.id, k.content
    FROM knowledge_chunks k
    JOIN knowledge_documents d ON d.id = k.document_id
    WHERE d.level = 'L3_NUTRITION'
      AND k.chunk_role IN ('child', 'standalone')
      AND k.embedding IS NULL
    ORDER BY k.created_at ASC
  `;

  if (!pending.length) {
    console.log('All L3 chunks already embedded.');
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`Pending: ${pending.length} chunk(s)`);
  const embedded = await embedChunkRows(
    prisma,
    pending.map((r) => ({ id: r.id, content: r.content })),
    { skipEmbed: false }
  );

  const counts = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS chunks,
           COUNT(*) FILTER (WHERE k.embedding IS NOT NULL)::int AS embedded
    FROM knowledge_chunks k
    JOIN knowledge_documents d ON d.id = k.document_id
    WHERE d.level = 'L3_NUTRITION'
  `;
  const { chunks, embedded: totalEmbedded } = counts[0];
  console.log(`\nEmbedded ${embedded} this run. L3 total: ${totalEmbedded}/${chunks} with vectors.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
