-- Telegram bot integration — account linking + granular alert prefs

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_chat_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_linked_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_link_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_link_token_expires_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_chat_id_key" ON "users"("telegram_chat_id") WHERE "telegram_chat_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_link_token_key" ON "users"("telegram_link_token");

ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_security_alerts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_coach_ai" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_fitness_achievements" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_orders" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_community_messages" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_social_activity" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_community_comments" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_daily_digest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_daily_digest_hour" TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_weekly_summary" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_meal_reminders" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_workout_missed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "telegram_ai_insights" BOOLEAN NOT NULL DEFAULT true;
