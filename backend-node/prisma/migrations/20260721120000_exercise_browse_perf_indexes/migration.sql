-- Workout library performance: saved list ordering + common filter composites.

CREATE INDEX IF NOT EXISTS "saved_exercises_user_id_created_at_idx"
  ON "saved_exercises"("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "exercises_public_browse_zone_idx"
  ON "exercises"("browse_muscle_zone")
  WHERE "is_public" = true AND "browse_muscle_zone" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "exercises_public_category_idx"
  ON "exercises"("category")
  WHERE "is_public" = true;

CREATE INDEX IF NOT EXISTS "exercises_public_difficulty_idx"
  ON "exercises"("difficulty")
  WHERE "is_public" = true AND "difficulty" IS NOT NULL;
