/**
 * Shared helpers for Block B Postgres RAG ingest scripts.
 */
const { PrismaClient } = require('@prisma/client');
const { isEmbeddingsConfigured, providerInfo, embeddingIdentity } = require('../../src/services/embeddingsProvider');
const { getEmbedBatchSize, getEmbedDelayMs, sleep, embedBatchWithRetry } = require('./embedBatch');
const { approxTokens, splitWithOverlap } = require('./markdownIngest');

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
  const { model } = providerInfo();
  const version = embeddingIdentity().version;
  const modelSql = model ? `'${String(model).replace(/'/g, "''")}'` : 'NULL';
  const versionSql = version ? `'${String(version).replace(/'/g, "''")}'` : 'NULL';
  await prisma.$executeRawUnsafe(
    `UPDATE knowledge_chunks
     SET embedding = '${lit}'::vector,
         embedding_model = ${modelSql},
         embedding_version = ${versionSql}
     WHERE id = '${chunkId}'`
  );
}

function buildSearchText(content, metadata = {}) {
  return [
    content,
    metadata.name,
    metadata.nameAr,
    metadata.nameEn,
    metadata.webtebId,
    metadata.exerciseId,
    metadata.foodItemId,
  ]
    .filter(Boolean)
    .join(' ');
}

async function setChunkSearchVector(prisma, chunkId, content, metadata = {}) {
  const text = buildSearchText(content, metadata).replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`
    UPDATE knowledge_chunks
    SET search_vector = to_tsvector('simple', '${text}')
    WHERE id = '${chunkId}'
  `);
}

/**
 * Create parent + child chunk rows for a document.
 * @returns {{ parentId: string|null, chunks: Array<{ id: string, content: string, role: string }> }}
 */
async function createParentChildChunks(prisma, { documentId, chunkSpecs, baseMetadata = {} }) {
  const idByIndex = new Map();
  const embeddable = [];

  for (let i = 0; i < chunkSpecs.length; i += 1) {
    const spec = chunkSpecs[i];
    const role = spec.role || 'standalone';
    const parentId =
      spec.parentIndex != null && idByIndex.has(spec.parentIndex)
        ? idByIndex.get(spec.parentIndex)
        : null;

    const metadata = {
      ...baseMetadata,
      level: baseMetadata.level,
      topic: spec.title || baseMetadata.topic,
      tokens: approxTokens(spec.text),
      chunkRole: role,
    };

    const row = await prisma.knowledgeChunk.create({
      data: {
        documentId,
        content: spec.text,
        chunkRole: role,
        parentId,
        metadata,
      },
    });

    idByIndex.set(i, row.id);
    await setChunkSearchVector(prisma, row.id, spec.text, metadata);

    if (role === 'child' || role === 'standalone') {
      embeddable.push({ id: row.id, content: spec.text });
    }
  }

  const parentId = [...idByIndex.values()][0] || null;
  return { parentId, embeddable, chunks: embeddable };
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
      console.error(
        `  ! Batch ${Math.floor(i / batchSize) + 1} failed after retries (${slice.length} chunks) — re-run rag:embed:l3 to resume`
      );
      break;
    }
    for (let j = 0; j < slice.length; j += 1) {
      await setChunkEmbedding(prisma, slice[j].id, vectors[j]);
      embedded += 1;
    }
    if (embedded % 200 === 0 || i + batchSize >= chunkRows.length) {
      console.log(`  embedded ${embedded}/${chunkRows.length}`);
    }
  }
  return embedded;
}

module.exports = {
  EMBED_DIMS,
  approxTokens,
  splitWithOverlap,
  getPrisma,
  padVector,
  setChunkEmbedding,
  setChunkSearchVector,
  buildSearchText,
  createParentChildChunks,
  purgeLevel,
  embedChunkRows,
  providerInfo,
  isEmbeddingsConfigured,
};
