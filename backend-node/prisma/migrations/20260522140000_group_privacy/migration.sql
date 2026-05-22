-- AlterTable
ALTER TABLE "community_groups" ADD COLUMN "posts_visibility" TEXT NOT NULL DEFAULT 'members_only';
ALTER TABLE "community_groups" ADD COLUMN "members_visibility" TEXT NOT NULL DEFAULT 'all_members';
