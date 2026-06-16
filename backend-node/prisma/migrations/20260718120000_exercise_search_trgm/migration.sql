-- Exercise library search: trigram indexes for fuzzy name matching (pg_trgm from RAG migration).
CREATE INDEX IF NOT EXISTS "exercises_name_trgm_idx"
  ON "exercises" USING gin (lower("name") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "exercises_name_ar_trgm_idx"
  ON "exercises" USING gin (lower(COALESCE("name_ar", '')) gin_trgm_ops);
