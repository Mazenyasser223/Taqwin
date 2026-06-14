-- Tier 3: embedding lifecycle — track model + version per chunk for reindex / shadow eval.
ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS embedding_model TEXT,
  ADD COLUMN IF NOT EXISTS embedding_version TEXT;

CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_model_idx
  ON knowledge_chunks (embedding_model)
  WHERE embedding_model IS NOT NULL;
