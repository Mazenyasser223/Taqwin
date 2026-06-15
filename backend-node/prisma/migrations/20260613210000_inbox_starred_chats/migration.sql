-- Starred inbox conversations
ALTER TABLE "community_conversation_participants"
  ADD COLUMN IF NOT EXISTS "starred_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "community_conversation_participants_user_id_starred_at_idx"
  ON "community_conversation_participants"("user_id", "starred_at");
