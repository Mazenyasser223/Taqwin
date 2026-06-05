/**
 * Shared helpers for Block B Postgres RAG ingest scripts.
 */
const { PrismaClient } = require('@prisma/client');
const { isEmbeddingsConfigured, providerInfo } = require('../../src/services/embeddingsProvider');
const { getEmbedBatchSize, getEmbedDelayMs, sleep, embedBatchWithRetry } = require('./embedBatch');
const { approxTokens } = require('./markdownIngest');

const EMBED_DIMS = Number(process.env.RAG_EMBED_DIMS || 1536);

function getPrisma() {
  const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('Set DIRECT_URL or DATABASE_URL');
  return new PrismaClient({ datasources: { db: { url: dbUrl } } });
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

async function setChunkEmbedding(prisma, chunkId, vector) {
  const padded = padVector(vector);
  if (!padded || padded.length !== EMBED_DIMS) {
    throw new Error(`Expected ${EMBED_DIMS}-dim embedding, got ${vector?.length ?? 0}`);
  }
  const lit = toVectorLiteral(padded);
  await prisma.$executeRawUnsafe(
    `UPDATE knowledge_chunks SET embedding = '${lit}'::vector WHERE id = '${chunkId}'`
  );
}

async function purgeLevel(prisma, level) {
  const docs = await prisma.knowledgeDocument.findMany({
    where: { level },
    select: { id: true },
  });
  if (!docs.length) return 0;
  const ids = docs.map((d) => d.id);
  await prisma.knowledgeChunk.deleteMany({ where: { documentId: { in: ids } } });
  await prisma.knowledgeDocument.deleteMany({ where: { id: { in: ids } } });
  return docs.length;
}

async function embedChunkRows(prisma, chunkRows, { skipEmbed = false } = {}) {
  if (skipEmbed || !chunkRows.length) return 0;
  if (!isEmbeddingsConfigured()) {
    console.warn('  ! No embeddings provider — chunks saved without vectors.');
    return 0;
  }

  const batchSize = getEmbedBatchSize(Number(process.env.RAG_INGEST_BATCH || 16));
  const delayMs = getEmbedDelayMs();
  let embedded = 0;

  for (let i = 0; i < chunkRows.length; i += batchSize) {
    if (i > 0 && delayMs > 0) await sleep(delayMs);
    const slice = chunkRows.slice(i, i + batchSize);
    const vectors = await embedBatchWithRetry(slice.map((c) => c.content));
    if (!vectors || !vectors.length) {
      throw new Error('Embedding provider returned no vectors');
    }
    for (let j = 0; j < slice.length; j += 1) {
      await setChunkEmbedding(prisma, slice[j].id, vectors[j]);
      embedded += 1;
    }
  }
  return embedded;
}

module.exports = {
  EMBED_DIMS,
  approxTokens,
  getPrisma,
  padVector,
  setChunkEmbedding,
  purgeLevel,
  embedChunkRows,
  providerInfo,
  isEmbeddingsConfigured,
};
