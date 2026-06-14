-- Community performance indexes
CREATE INDEX IF NOT EXISTS "community_posts_author_id_created_at_idx"
  ON "community_posts" ("author_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "community_post_tags_tagged_user_id_idx"
  ON "community_post_tags" ("tagged_user_id");

CREATE INDEX IF NOT EXISTS "community_post_likes_post_id_idx"
  ON "community_post_likes" ("post_id");

CREATE INDEX IF NOT EXISTS "community_comment_likes_comment_id_idx"
  ON "community_comment_likes" ("comment_id");

CREATE INDEX IF NOT EXISTS "community_posts_trending_idx"
  ON "community_posts" ("likes_count" DESC, "reposts_count" DESC, "created_at" DESC);
