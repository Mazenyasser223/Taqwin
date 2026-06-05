-- AlterTable
ALTER TABLE "community_privacy_settings" ADD COLUMN IF NOT EXISTS "presence_audience" TEXT NOT NULL DEFAULT 'everyone';
