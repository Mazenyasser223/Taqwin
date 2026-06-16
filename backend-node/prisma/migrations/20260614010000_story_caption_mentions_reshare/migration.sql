-- Story captions, @mentions, and Instagram-style reshares
ALTER TABLE "community_stories"
  ADD COLUMN IF NOT EXISTS "caption" TEXT,
  ADD COLUMN IF NOT EXISTS "reshared_from_story_id" TEXT,
  ADD COLUMN IF NOT EXISTS "reshared_from_author_id" TEXT;

CREATE INDEX IF NOT EXISTS "community_stories_reshared_from_story_id_idx"
  ON "community_stories"("reshared_from_story_id");

CREATE TABLE IF NOT EXISTS "community_story_mentions" (
  "id" TEXT NOT NULL,
  "story_id" TEXT NOT NULL,
  "mentioned_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_story_mentions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "community_story_mentions_story_id_mentioned_user_id_key"
  ON "community_story_mentions"("story_id", "mentioned_user_id");

CREATE INDEX IF NOT EXISTS "community_story_mentions_mentioned_user_id_idx"
  ON "community_story_mentions"("mentioned_user_id");

ALTER TABLE "community_stories"
  ADD CONSTRAINT "community_stories_reshared_from_story_id_fkey"
  FOREIGN KEY ("reshared_from_story_id") REFERENCES "community_stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_stories"
  ADD CONSTRAINT "community_stories_reshared_from_author_id_fkey"
  FOREIGN KEY ("reshared_from_author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "community_story_mentions"
  ADD CONSTRAINT "community_story_mentions_story_id_fkey"
  FOREIGN KEY ("story_id") REFERENCES "community_stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_story_mentions"
  ADD CONSTRAINT "community_story_mentions_mentioned_user_id_fkey"
  FOREIGN KEY ("mentioned_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
