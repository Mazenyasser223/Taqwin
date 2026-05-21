ALTER TABLE "community_follows" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'accepted';

UPDATE "community_follows" SET "status" = 'accepted' WHERE "status" IS NULL OR "status" = '';

CREATE INDEX IF NOT EXISTS "community_follows_following_id_status_idx" ON "community_follows"("following_id", "status");
CREATE INDEX IF NOT EXISTS "community_follows_follower_id_status_idx" ON "community_follows"("follower_id", "status");
