-- Community social v2: privacy, stories, saves, rings, tags, rich messages, actor notifications

CREATE TABLE IF NOT EXISTS "community_privacy_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reposts_audience" TEXT NOT NULL DEFAULT 'followers',
    "saved_posts_audience" TEXT NOT NULL DEFAULT 'only_me',
    "story_audience" TEXT NOT NULL DEFAULT 'followers',
    "story_hide_from_ids" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "community_privacy_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_privacy_settings_user_id_key" ON "community_privacy_settings"("user_id");

ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "location_name" TEXT;
ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "location_lat" DOUBLE PRECISION;
ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "location_lng" DOUBLE PRECISION;
ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "comments_locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "reposts_locked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'everyone';

ALTER TABLE "community_messages" ADD COLUMN IF NOT EXISTS "message_type" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "community_messages" ADD COLUMN IF NOT EXISTS "media_url" TEXT;

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "actor_id" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "actor_display_name" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "actor_avatar_url" TEXT;

CREATE TABLE IF NOT EXISTS "community_post_tags" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "tagged_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_post_tags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_post_tags_post_id_tagged_user_id_key" ON "community_post_tags"("post_id", "tagged_user_id");

CREATE TABLE IF NOT EXISTS "community_saved_posts" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_saved_posts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_saved_posts_post_id_user_id_key" ON "community_saved_posts"("post_id", "user_id");

CREATE TABLE IF NOT EXISTS "community_post_rings" (
    "id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_post_rings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_post_rings_subscriber_id_target_user_id_key" ON "community_post_rings"("subscriber_id", "target_user_id");

CREATE TABLE IF NOT EXISTS "community_stories" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "media_url" TEXT NOT NULL,
    "media_type" TEXT NOT NULL DEFAULT 'image',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "community_stories_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "community_stories_author_id_expires_at_idx" ON "community_stories"("author_id", "expires_at");

CREATE TABLE IF NOT EXISTS "community_story_views" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "viewer_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_story_views_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "community_story_views_story_id_viewer_id_key" ON "community_story_views"("story_id", "viewer_id");
