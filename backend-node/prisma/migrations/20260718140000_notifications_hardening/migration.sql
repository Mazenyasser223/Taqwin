-- Notification hardening: inbox index, emit counters, partial dedupe index

CREATE INDEX IF NOT EXISTS "notifications_inbox_list_idx"
  ON "notifications" ("user_id", "deleted_at", "archived_at", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "notification_pending_user_deliver_idx"
  ON "notification_pending" ("user_id", "deliver_after");

-- Partial unique already satisfied by nullable unique column; explicit partial index for lookups
CREATE INDEX IF NOT EXISTS "notifications_dedupe_key_partial_idx"
  ON "notifications" ("dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "notification_emit_counters" (
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "window_key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "notification_emit_counters_pkey" PRIMARY KEY ("user_id", "type", "window_key")
);

CREATE INDEX IF NOT EXISTS "notification_emit_counters_window_key_idx"
  ON "notification_emit_counters" ("window_key");
