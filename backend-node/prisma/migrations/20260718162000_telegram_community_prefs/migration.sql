ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_group_invites" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_follow_requests" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_mentions" BOOLEAN NOT NULL DEFAULT false;
