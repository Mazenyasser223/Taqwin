-- Group DM / inbox columns (may already exist from dev scripts)
ALTER TABLE "community_conversations"
  ADD COLUMN IF NOT EXISTS "is_group" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "name" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "avatar_url" TEXT,
  ADD COLUMN IF NOT EXISTS "bio" TEXT,
  ADD COLUMN IF NOT EXISTS "can_add_members" VARCHAR(10) NOT NULL DEFAULT 'admins',
  ADD COLUMN IF NOT EXISTS "can_send_messages" VARCHAR(10) NOT NULL DEFAULT 'all';

ALTER TABLE "community_conversation_participants"
  ADD COLUMN IF NOT EXISTS "role" VARCHAR(10) NOT NULL DEFAULT 'member';
