-- Persist which meal plan slot a food log belongs to (breakfast, lunch, etc.)
ALTER TABLE "food_logs" ADD COLUMN IF NOT EXISTS "meal_slot_id" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "food_logs_user_id_meal_slot_id_logged_at_idx"
  ON "food_logs"("user_id", "meal_slot_id", "logged_at");
