/* eslint-disable no-console */
/**
 * Embed missing L5 book vectors (resume after interrupted B8 ingest).
 *
 *   node scripts/rag/embed-l5-missing.js
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
  console.log(`Block B8 resume — embed missing L5 chunks (${model})`);

  const pending = await prisma.$queryRaw`
    SELECT k.id, k.content
    FROM knowledge_chunks k
    JOIN knowledge_documents d ON d.id = k.document_id
    WHERE d.level = 'L5_BOOKS'
      AND k.chunk_role IN ('child', 'standalone')
      AND k.embedding IS NULL
    ORDER BY k.created_at ASC
  `;

  if (!pending.length) {
    console.log('All L5 chunks already embedded.');
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
    WHERE d.level = 'L5_BOOKS'
  `;
  const { chunks, embedded: totalEmbedded } = counts[0];
  console.log(`\nEmbedded ${embedded} this run. L5 total: ${totalEmbedded}/${chunks} with vectors.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
