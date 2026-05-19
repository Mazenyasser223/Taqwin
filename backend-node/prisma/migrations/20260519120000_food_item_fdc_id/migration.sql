-- Add USDA FoodData Central ID for cached imports
ALTER TABLE "food_items" ADD COLUMN "fdc_id" INTEGER;

CREATE UNIQUE INDEX "food_items_fdc_id_key" ON "food_items"("fdc_id");
