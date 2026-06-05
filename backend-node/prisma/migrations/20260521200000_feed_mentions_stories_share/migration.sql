ALTER TABLE "community_privacy_settings" ADD COLUMN IF NOT EXISTS "mentions_audience" TEXT NOT NULL DEFAULT 'everyone';
ALTER TABLE "community_privacy_settings" ADD COLUMN IF NOT EXISTS "shares_audience" TEXT NOT NULL DEFAULT 'everyone';

CREATE TABLE IF NOT EXISTS "community_post_gym_mentions" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_post_gym_mentions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_post_gym_mentions_post_id_gym_id_key" ON "community_post_gym_mentions"("post_id", "gym_id");

CREATE TABLE IF NOT EXISTS "community_story_reactions" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT 'love',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_story_reactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_story_reactions_story_id_user_id_key" ON "community_story_reactions"("story_id", "user_id");

CREATE TABLE IF NOT EXISTS "community_story_replies" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_story_replies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "community_story_replies_story_id_created_at_idx" ON "community_story_replies"("story_id", "created_at");
