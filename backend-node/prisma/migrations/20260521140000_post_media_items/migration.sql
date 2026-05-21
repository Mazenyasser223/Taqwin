CREATE TABLE IF NOT EXISTS "community_post_media" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_post_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "community_post_media_post_id_sort_order_idx" ON "community_post_media"("post_id", "sort_order");

DO $$ BEGIN
  ALTER TABLE "community_post_media" ADD CONSTRAINT "community_post_media_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
