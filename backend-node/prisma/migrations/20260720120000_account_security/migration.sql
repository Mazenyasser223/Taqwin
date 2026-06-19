-- Session revocation + account audit + remove unused notification prefs
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "account_audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "email" TEXT,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "ip_address" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "account_audit_logs_user_id_created_at_idx"
  ON "account_audit_logs"("user_id", "created_at");

ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "notify_workout_reminders";
ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "notify_ai_suggestions";
ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "digest_notifications";
