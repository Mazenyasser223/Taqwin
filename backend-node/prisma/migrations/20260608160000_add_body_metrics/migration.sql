-- body_metrics was omitted when ai_coach_a0 was partially rolled back on some environments.

CREATE TABLE IF NOT EXISTS "body_metrics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "weight_kg" DOUBLE PRECISION,
    "body_fat_pct" DOUBLE PRECISION,
    "measurements" JSONB,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "body_metrics_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "body_metrics_user_id_recorded_at_idx"
    ON "body_metrics"("user_id", "recorded_at");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'body_metrics_user_id_fkey'
    ) THEN
        ALTER TABLE "body_metrics"
            ADD CONSTRAINT "body_metrics_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
