-- AlterTable
ALTER TABLE "community_groups" ADD COLUMN "join_policy" TEXT NOT NULL DEFAULT 'open';

-- AlterTable
ALTER TABLE "community_group_members" ADD COLUMN "invited_by" TEXT;
