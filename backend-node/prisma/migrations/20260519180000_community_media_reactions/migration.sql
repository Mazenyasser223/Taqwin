ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "cover_url" TEXT;

ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "video_url" TEXT;
ALTER TABLE "community_posts" ADD COLUMN IF NOT EXISTS "media_type" TEXT;

ALTER TABLE "community_post_likes" ADD COLUMN IF NOT EXISTS "emoji" TEXT NOT NULL DEFAULT 'like';
