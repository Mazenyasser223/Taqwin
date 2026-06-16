-- Freeze per-100g macros on food logs so later FoodItem edits do not rewrite history.
ALTER TABLE "food_logs"
  ADD COLUMN IF NOT EXISTS "snapshot_name" TEXT,
  ADD COLUMN IF NOT EXISTS "snapshot_calories" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "snapshot_protein" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "snapshot_carbs" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "snapshot_fat" DOUBLE PRECISION;

UPDATE "food_logs" AS fl
SET
  "snapshot_name" = fi.name,
  "snapshot_calories" = fi.calories,
  "snapshot_protein" = fi.protein,
  "snapshot_carbs" = fi.carbs,
  "snapshot_fat" = fi.fat
FROM "food_items" AS fi
WHERE fl.food_item_id = fi.id
  AND fl.snapshot_calories IS NULL;
