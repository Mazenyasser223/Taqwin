-- Pinned posts on profiles and featured posts in groups
ALTER TABLE "community_posts"
  ADD COLUMN IF NOT EXISTS "profile_pinned_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "group_pinned_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "community_posts_author_profile_pinned_idx"
  ON "community_posts"("author_id", "profile_pinned_at");

CREATE INDEX IF NOT EXISTS "community_posts_group_featured_idx"
  ON "community_posts"("group_id", "group_pinned_at");
