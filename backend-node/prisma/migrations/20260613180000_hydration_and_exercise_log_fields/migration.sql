-- HydrationLog + structured ExerciseLog fields (coach tools Phase A)

ALTER TABLE "exercise_logs" ADD COLUMN IF NOT EXISTS "sets" INTEGER;
ALTER TABLE "exercise_logs" ADD COLUMN IF NOT EXISTS "reps" VARCHAR(32);
ALTER TABLE "exercise_logs" ADD COLUMN IF NOT EXISTS "weight_kg" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "hydration_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ml" INTEGER NOT NULL,

    CONSTRAINT "hydration_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "hydration_logs_user_id_logged_at_idx" ON "hydration_logs"("user_id", "logged_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hydration_logs_user_id_fkey'
  ) THEN
    ALTER TABLE "hydration_logs" ADD CONSTRAINT "hydration_logs_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
