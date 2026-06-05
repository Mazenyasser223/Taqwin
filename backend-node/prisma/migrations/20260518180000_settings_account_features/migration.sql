-- AlterTable users (email change + 2FA)
ALTER TABLE "users" ADD COLUMN "pending_email" TEXT;
ALTER TABLE "users" ADD COLUMN "email_change_code" TEXT;
ALTER TABLE "users" ADD COLUMN "email_change_code_expiry" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "two_factor_secret" TEXT;

-- AlterTable user_settings (units + timezone)
ALTER TABLE "user_settings" ADD COLUMN "unit_system" TEXT NOT NULL DEFAULT 'metric';
ALTER TABLE "user_settings" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
