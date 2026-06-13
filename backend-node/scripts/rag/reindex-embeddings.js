/**
 * Tier 3 — re-embed knowledge chunks when embedding model/version changes.
 *
 * Usage:
 *   node scripts/rag/reindex-embeddings.js
 *   node scripts/rag/reindex-embeddings.js --level L2_EXERCISE
 *   node scripts/rag/reindex-embeddings.js --dry-run
 *   RAG_EMBED_VERSION=2 node scripts/rag/reindex-embeddings.js
 */
const {
  getPrisma,
  embedChunkRows,
} = require('../lib/pgvectorIngest');
const { isEmbeddingsConfigured, providerInfo, embeddingIdentity } = require('../../src/services/embeddingsProvider');

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const levelArg = args.find((a) => a.startsWith('--level='));
  const levelFilter = levelArg ? levelArg.split('=')[1] : null;

  if (!isEmbeddingsConfigured()) {
    console.error('No embeddings provider configured.');
    process.exit(1);
  }

  const { model } = providerInfo();
  const { version } = embeddingIdentity();
  console.log(`Reindex target: model=${model} version=${version}`);

  const prisma = getPrisma();
  try {
    const levelClause = levelFilter
      ? `AND d.level = '${levelFilter.replace(/'/g, "''")}'`
      : '';

    const stale = await prisma.$queryRawUnsafe(`
      SELECT k.id, k.content, k.chunk_role, d.level
      FROM knowledge_chunks k
      INNER JOIN knowledge_documents d ON d.id = k.document_id
      WHERE k.chunk_role IN ('child', 'standalone')
        AND k.content IS NOT NULL
        ${levelClause}
        AND (
          k.embedding IS NULL
          OR k.embedding_model IS DISTINCT FROM '${String(model || '').replace(/'/g, "''")}'
          OR k.embedding_version IS DISTINCT FROM '${String(version).replace(/'/g, "''")}'
        )
      ORDER BY d.level, k.id
    `);

    console.log(`Stale/missing chunks: ${stale.length}`);
    if (dryRun) {
      const byLevel = {};
      for (const row of stale) {
        byLevel[row.level] = (byLevel[row.level] || 0) + 1;
      }
      console.log('By level:', byLevel);
      return;
    }

    const rows = stale.map((r) => ({ id: r.id, content: r.content }));
    const embedded = await embedChunkRows(prisma, rows);
    console.log(`Re-embedded ${embedded} chunks.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
