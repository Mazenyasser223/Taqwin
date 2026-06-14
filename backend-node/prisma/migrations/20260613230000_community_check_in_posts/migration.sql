-- Link community posts to gym check-ins
ALTER TABLE "community_posts"
  ADD COLUMN IF NOT EXISTS "check_in_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "community_posts_check_in_id_key"
  ON "community_posts"("check_in_id")
  WHERE "check_in_id" IS NOT NULL;

ALTER TABLE "community_posts"
  ADD CONSTRAINT "community_posts_check_in_id_fkey"
  FOREIGN KEY ("check_in_id") REFERENCES "gym_check_ins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
