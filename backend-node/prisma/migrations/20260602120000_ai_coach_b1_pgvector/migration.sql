-- Block B1 — pgvector index on knowledge_chunks (RAG retrieval infra)
-- Prerequisite: enable "vector" in Supabase → Database → Extensions (if CREATE EXTENSION fails)

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "knowledge_chunks"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Cosine similarity — matches OpenAI text-embedding-3-small (1536 dims)
CREATE INDEX IF NOT EXISTS "knowledge_chunks_embedding_hnsw_idx"
  ON "knowledge_chunks"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE "embedding" IS NOT NULL;
