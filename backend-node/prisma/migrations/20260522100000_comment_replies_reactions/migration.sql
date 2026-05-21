-- Comment replies, reactions, and updated_at
ALTER TABLE "community_comments" ADD COLUMN IF NOT EXISTS "parent_id" TEXT;
ALTER TABLE "community_comments" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "community_comments_post_id_idx" ON "community_comments"("post_id");
CREATE INDEX IF NOT EXISTS "community_comments_parent_id_idx" ON "community_comments"("parent_id");

ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "community_comment_likes" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT 'like',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_comment_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "community_comment_likes_comment_id_user_id_key"
  ON "community_comment_likes"("comment_id", "user_id");

ALTER TABLE "community_comment_likes" ADD CONSTRAINT "community_comment_likes_comment_id_fkey"
  FOREIGN KEY ("comment_id") REFERENCES "community_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_comment_likes" ADD CONSTRAINT "community_comment_likes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
