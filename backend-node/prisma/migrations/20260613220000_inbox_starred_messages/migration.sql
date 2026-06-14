-- Starred inbox messages
CREATE TABLE IF NOT EXISTS "community_message_stars" (
  "id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "starred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_message_stars_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "community_message_stars_message_id_user_id_key"
  ON "community_message_stars"("message_id", "user_id");

CREATE INDEX IF NOT EXISTS "community_message_stars_user_id_starred_at_idx"
  ON "community_message_stars"("user_id", "starred_at");

ALTER TABLE "community_message_stars"
  ADD CONSTRAINT "community_message_stars_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "community_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_message_stars"
  ADD CONSTRAINT "community_message_stars_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
