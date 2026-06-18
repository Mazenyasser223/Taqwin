-- Notifications v2: grouping, payload, priority, lifecycle, analytics

ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "quiet_hours_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "quiet_hours_start" TEXT NOT NULL DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS "quiet_hours_end" TEXT NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS "digest_notifications" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "payload" JSONB,
  ADD COLUMN IF NOT EXISTS "group_key" TEXT,
  ADD COLUMN IF NOT EXISTS "actor_ids" JSONB,
  ADD COLUMN IF NOT EXISTS "actor_count" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "actions" JSONB,
  ADD COLUMN IF NOT EXISTS "icon" TEXT,
  ADD COLUMN IF NOT EXISTS "image_url" TEXT,
  ADD COLUMN IF NOT EXISTS "schema_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "dedupe_key" TEXT,
  ADD COLUMN IF NOT EXISTS "collapsed_count" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "seen_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "snoozed_until" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "notifications" SET "read_at" = "created_at" WHERE "read" = true AND "read_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
CREATE INDEX IF NOT EXISTS "notifications_user_id_group_key_idx" ON "notifications"("user_id", "group_key");
CREATE INDEX IF NOT EXISTS "notifications_user_id_category_created_at_idx" ON "notifications"("user_id", "category", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");
CREATE INDEX IF NOT EXISTS "notifications_expires_at_idx" ON "notifications"("expires_at");
CREATE INDEX IF NOT EXISTS "notifications_deleted_at_idx" ON "notifications"("deleted_at");
CREATE INDEX IF NOT EXISTS "notifications_archived_at_idx" ON "notifications"("archived_at");

CREATE TABLE IF NOT EXISTS "notification_pending" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "deliver_after" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_pending_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notification_pending_deliver_after_idx" ON "notification_pending"("deliver_after");
CREATE INDEX IF NOT EXISTS "notification_pending_user_id_idx" ON "notification_pending"("user_id");

ALTER TABLE "notification_pending"
  ADD CONSTRAINT "notification_pending_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "notification_snoozes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "notification_id" TEXT NOT NULL,
  "snoozed_until" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_snoozes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notification_snoozes_snoozed_until_idx" ON "notification_snoozes"("snoozed_until");
CREATE INDEX IF NOT EXISTS "notification_snoozes_user_id_idx" ON "notification_snoozes"("user_id");

ALTER TABLE "notification_snoozes"
  ADD CONSTRAINT "notification_snoozes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_snoozes"
  ADD CONSTRAINT "notification_snoozes_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "notification_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "notification_id" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notification_events_notification_id_idx" ON "notification_events"("notification_id");
CREATE INDEX IF NOT EXISTS "notification_events_user_id_created_at_idx" ON "notification_events"("user_id", "created_at");

ALTER TABLE "notification_events"
  ADD CONSTRAINT "notification_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_events"
  ADD CONSTRAINT "notification_events_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
