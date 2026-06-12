/**
 * RAG retrieval policy — pgvector-first in production; Mongo Atlas vector is dev-only fallback.
 */
const { isEmbeddingsConfigured } = require('../../services/embeddingsProvider');
const { logger } = require('../logger');

function isProductionEnv() {
  return process.env.NODE_ENV === 'production';
}

/** Postgres pgvector is the primary RAG path when embeddings are configured. */
function preferPgvector() {
  if (String(process.env.RAG_PREFER_PGVECTOR || '').toLowerCase() === 'false') return false;
  if (isProductionEnv()) return true;
  return String(process.env.RAG_PREFER_PGVECTOR || '').toLowerCase() === 'true';
}

/**
 * MongoDB Atlas Vector Search — disabled in production unless explicitly opted in.
 */
function isMongoVectorSearchEnabled() {
  const explicit = String(process.env.MONGO_VECTOR_SEARCH || '').toLowerCase() === 'true';
  if (isProductionEnv() && !explicit) return false;
  return explicit;
}

/**
 * SQL catalog pool as degraded mode when vector search fails or returns thin hits.
 * Set RAG_STRICT_VECTOR=true to disable SQL fallback (empty + traced error instead).
 */
function isSqlFallbackEnabled() {
  if (String(process.env.RAG_STRICT_VECTOR || '').toLowerCase() === 'true') return false;
  const flag = String(process.env.RAG_SQL_FALLBACK || 'true').toLowerCase();
  return flag !== 'false' && flag !== '0';
}

/**
 * Production boot gate — embeddings required for RAG (chat + plan catalog + books).
 * @returns {{ ok: boolean, message?: string }}
 */
function checkProductionEmbeddings() {
  if (!isProductionEnv()) return { ok: true };
  if (isEmbeddingsConfigured()) return { ok: true };
  return {
    ok: false,
    message:
      'Production requires embeddings: set OPENAI_API_KEY, VOYAGE_API_KEY, or EMBED_PROVIDER=ollama with OLLAMA_BASE_URL',
  };
}

/** Log and exit(1) in production when embeddings are missing (skip in test). */
function assertProductionRagReady() {
  if (process.env.NODE_ENV === 'test') return;
  const check = checkProductionEmbeddings();
  if (check.ok) return;
  logger.error(check.message);
  if (isProductionEnv()) {
    process.exit(1);
  }
  logger.warn('Embeddings not configured — RAG will degrade (dev only)');
}

module.exports = {
  isProductionEnv,
  preferPgvector,
  isMongoVectorSearchEnabled,
  isSqlFallbackEnabled,
  checkProductionEmbeddings,
  assertProductionRagReady,
};
