-- Tier 2 RAG: hybrid search (tsvector + trigram), parent-child chunks

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- parent_id must be TEXT to match knowledge_chunks.id (not UUID)
ALTER TABLE "knowledge_chunks" DROP COLUMN IF EXISTS "parent_id";

ALTER TABLE "knowledge_chunks"
  ADD COLUMN IF NOT EXISTS "parent_id" TEXT,
  ADD COLUMN IF NOT EXISTS "chunk_role" VARCHAR(16) NOT NULL DEFAULT 'standalone',
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

ALTER TABLE "knowledge_chunks"
  DROP CONSTRAINT IF EXISTS "knowledge_chunks_parent_id_fkey";

ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "knowledge_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "knowledge_chunks_search_vector_gin_idx"
  ON "knowledge_chunks" USING GIN ("search_vector");

CREATE INDEX IF NOT EXISTS "knowledge_chunks_content_trgm_idx"
  ON "knowledge_chunks" USING GIN ("content" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "knowledge_chunks_parent_id_idx"
  ON "knowledge_chunks"("parent_id");

-- Backfill search_vector from content + common metadata name fields
UPDATE "knowledge_chunks" k
SET "search_vector" = to_tsvector(
  'simple',
  coalesce(k.content, '') || ' ' ||
  coalesce(k.metadata->>'name', '') || ' ' ||
  coalesce(k.metadata->>'nameAr', '') || ' ' ||
  coalesce(k.metadata->>'nameEn', '') || ' ' ||
  coalesce(k.metadata->>'webtebId', '') || ' ' ||
  coalesce(k.metadata->>'exerciseId', '') || ' ' ||
  coalesce(k.metadata->>'foodItemId', '')
)
WHERE k."search_vector" IS NULL;
