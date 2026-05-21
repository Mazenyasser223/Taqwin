-- Block users + message request status on DMs

CREATE TABLE IF NOT EXISTS "community_blocks" (
    "id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "community_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "community_blocks_blocker_id_blocked_id_key" ON "community_blocks"("blocker_id", "blocked_id");
CREATE INDEX IF NOT EXISTS "community_blocks_blocked_id_idx" ON "community_blocks"("blocked_id");

DO $$ BEGIN
  ALTER TABLE "community_blocks" ADD CONSTRAINT "community_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "community_blocks" ADD CONSTRAINT "community_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "community_conversations" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "community_conversations" ADD COLUMN IF NOT EXISTS "initiated_by_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "community_conversations" ADD CONSTRAINT "community_conversations_initiated_by_id_fkey" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
