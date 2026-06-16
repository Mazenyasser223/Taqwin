-- User favorite/saved exercises (workout library)
CREATE TABLE IF NOT EXISTS "saved_exercises" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_exercises_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "saved_exercises_user_id_exercise_id_key"
  ON "saved_exercises"("user_id", "exercise_id");

CREATE INDEX IF NOT EXISTS "saved_exercises_exercise_id_idx"
  ON "saved_exercises"("exercise_id");

DO $$ BEGIN
  ALTER TABLE "saved_exercises"
    ADD CONSTRAINT "saved_exercises_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "saved_exercises"
    ADD CONSTRAINT "saved_exercises_exercise_id_fkey"
    FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
