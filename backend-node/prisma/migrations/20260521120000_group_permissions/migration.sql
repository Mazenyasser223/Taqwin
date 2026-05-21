ALTER TABLE "community_groups" ADD COLUMN IF NOT EXISTS "post_permission" TEXT NOT NULL DEFAULT 'all_members';
ALTER TABLE "community_groups" ADD COLUMN IF NOT EXISTS "invite_permission" TEXT NOT NULL DEFAULT 'admins_only';
