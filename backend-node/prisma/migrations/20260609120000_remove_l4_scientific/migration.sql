-- Remove L4_SCIENTIFIC (no ingest pipeline; scientific intent uses L5 books only).

DELETE FROM "knowledge_chunks"
WHERE "document_id" IN (
  SELECT "id" FROM "knowledge_documents" WHERE "level" = 'L4_SCIENTIFIC'
);

DELETE FROM "knowledge_documents" WHERE "level" = 'L4_SCIENTIFIC';

ALTER TYPE "KnowledgeLevel" RENAME TO "KnowledgeLevel_old";

CREATE TYPE "KnowledgeLevel" AS ENUM (
  'L1_INTERNAL',
  'L2_EXERCISE',
  'L3_NUTRITION',
  'L5_BOOKS'
);

ALTER TABLE "knowledge_documents"
  ALTER COLUMN "level" TYPE "KnowledgeLevel"
  USING ("level"::text::"KnowledgeLevel");

DROP TYPE "KnowledgeLevel_old";
