-- MuscleWiki exercise catalog (may already exist in production)
CREATE TABLE IF NOT EXISTS "exercises" (
    "id" TEXT NOT NULL,
    "musclewiki_id" INTEGER NOT NULL,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "difficulty" TEXT,
    "force" TEXT,
    "mechanic" TEXT,
    "grips" JSONB,
    "primary_muscles" JSONB NOT NULL,
    "secondary_muscles" JSONB,
    "steps" JSONB NOT NULL,
    "videos" JSONB NOT NULL,
    "thumbnail_url" TEXT,
    "long_description" TEXT,
    "source" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "exercises_category_idx" ON "exercises"("category");
CREATE INDEX IF NOT EXISTS "exercises_is_public_idx" ON "exercises"("is_public");

CREATE TABLE IF NOT EXISTS "exercise_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "exercise_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "exercise_logs_user_id_logged_at_idx" ON "exercise_logs"("user_id", "logged_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercise_logs_user_id_fkey'
  ) THEN
    ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercise_logs_exercise_id_fkey'
  ) THEN
    ALTER TABLE "exercise_logs" ADD CONSTRAINT "exercise_logs_exercise_id_fkey"
      FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
