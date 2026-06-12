/**
 * Block B5 — pgvector cosine search over knowledge_chunks (Postgres).
 *
 * Used by POST /api/internal/ai/rag/search (FastAPI retriever in B6).
 */
const { prisma } = require('../../db');
const { embed, isEmbeddingsConfigured, providerInfo } = require('../../services/embeddingsProvider');

const EMBED_DIMS = Number(process.env.RAG_EMBED_DIMS || 1536);
const DEFAULT_LIMIT = Number(process.env.RAG_SEARCH_DEFAULT_LIMIT || 8);
const MAX_LIMIT = Number(process.env.RAG_SEARCH_MAX_LIMIT || 50);

const VALID_LEVELS = new Set([
  'L1_INTERNAL',
  'L2_EXERCISE',
  'L3_NUTRITION',
  'L5_BOOKS',
]);

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

function normalizeLevels(levels) {
  if (!Array.isArray(levels) || !levels.length) {
    throw new Error('At least one knowledge level is required');
  }
  const out = [];
  for (const level of levels) {
    const v = String(level || '').trim();
    if (!VALID_LEVELS.has(v)) {
      throw new Error(`Invalid knowledge level: ${v}`);
    }
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

function clampLimit(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function mapRow(row) {
  const distance = Number(row.distance);
  const score = Number.isFinite(distance) ? Math.max(0, 1 - distance) : 0;
  return {
    chunkId: row.chunk_id,
    documentId: row.document_id,
    level: row.level,
    source: row.source,
    title: row.title,
    locale: row.locale,
    content: row.content,
    metadata: row.metadata ?? null,
    score,
    distance,
  };
}

/**
 * @param {{
 *   query: string,
 *   levels: string[],
 *   limit?: number,
 *   locale?: 'en'|'ar',
 *   minScore?: number,
 * }} opts
 * @returns {Promise<{ query: string, levels: string[], limit: number, embedding: object, results: object[] }>}
 */
async function searchKnowledge({ query, levels, limit, locale, minScore } = {}) {
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    throw new Error('query is required');
  }

  if (!isEmbeddingsConfigured()) {
    const err = new Error('Embeddings provider not configured');
    err.code = 'EMBEDDINGS_NOT_CONFIGURED';
    throw err;
  }

  const levelList = normalizeLevels(levels);
  const take = clampLimit(limit);
  const vector = await embed(trimmed);
  if (!vector || !vector.length) {
    throw new Error('Failed to embed query');
  }

  const padded = padVector(vector);
  if (padded.length !== EMBED_DIMS) {
    throw new Error(`Expected ${EMBED_DIMS}-dim query embedding, got ${padded.length}`);
  }

  const vecLit = toVectorLiteral(padded);
  const levelSql = levelList.map((l) => `'${l}'`).join(', ');

  let localeClause = '';
  if (locale === 'en' || locale === 'ar') {
    localeClause = `AND (d.locale = '${locale}' OR d.locale = 'en')`;
  }

  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      k.id AS chunk_id,
      d.id AS document_id,
      d.level::text AS level,
      d.source,
      d.title,
      d.locale,
      k.content,
      k.metadata,
      (k.embedding <=> '${vecLit}'::vector)::float8 AS distance
    FROM knowledge_chunks k
    INNER JOIN knowledge_documents d ON d.id = k.document_id
    WHERE k.embedding IS NOT NULL
      AND d.level IN (${levelSql})
      ${localeClause}
    ORDER BY k.embedding <=> '${vecLit}'::vector
    LIMIT ${take}
  `);

  let results = rows.map(mapRow);
  if (typeof minScore === 'number' && Number.isFinite(minScore)) {
    results = results.filter((r) => r.score >= minScore);
  }

  const { provider, model } = providerInfo();
  return {
    query: trimmed,
    levels: levelList,
    limit: take,
    locale: locale || null,
    embedding: { provider, model, dimensions: EMBED_DIMS },
    results,
  };
}

module.exports = {
  VALID_LEVELS,
  EMBED_DIMS,
  searchKnowledge,
  normalizeLevels,
  clampLimit,
  toVectorLiteral,
  padVector,
};
