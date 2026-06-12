import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);
const {
  preferPgvector,
  isMongoVectorSearchEnabled,
  isSqlFallbackEnabled,
  checkProductionEmbeddings,
} = requireFromHere('../src/lib/rag/ragConfig');

describe('ragConfig', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('prefers pgvector in production by default', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RAG_PREFER_PGVECTOR;
    expect(preferPgvector()).toBe(true);
  });

  it('disables mongo vector search in production unless explicit', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MONGO_VECTOR_SEARCH;
    expect(isMongoVectorSearchEnabled()).toBe(false);
    process.env.MONGO_VECTOR_SEARCH = 'true';
    expect(isMongoVectorSearchEnabled()).toBe(true);
  });

  it('allows mongo vector in development when enabled', () => {
    process.env.NODE_ENV = 'development';
    process.env.MONGO_VECTOR_SEARCH = 'true';
    expect(isMongoVectorSearchEnabled()).toBe(true);
  });

  it('enables SQL fallback by default (resilient production)', () => {
    delete process.env.RAG_STRICT_VECTOR;
    delete process.env.RAG_SQL_FALLBACK;
    expect(isSqlFallbackEnabled()).toBe(true);
  });

  it('disables SQL fallback when RAG_STRICT_VECTOR=true', () => {
    process.env.RAG_STRICT_VECTOR = 'true';
    expect(isSqlFallbackEnabled()).toBe(false);
  });

  it('checkProductionEmbeddings passes in development without keys', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.OPENAI_API_KEY;
    delete process.env.VOYAGE_API_KEY;
    expect(checkProductionEmbeddings().ok).toBe(true);
  });

  it('checkProductionEmbeddings fails in production without keys', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.OPENAI_API_KEY;
    delete process.env.VOYAGE_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    expect(checkProductionEmbeddings().ok).toBe(false);
  });
});
