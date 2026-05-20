-- WebTeb nutrition import tables + FoodItem.webteb_id

ALTER TABLE "food_items" ADD COLUMN IF NOT EXISTS "webteb_id" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "food_items_webteb_id_key" ON "food_items"("webteb_id");

CREATE TABLE IF NOT EXISTS "webteb_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'restaurant',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "webteb_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "webteb_categories_slug_key" ON "webteb_categories"("slug");

CREATE TABLE IF NOT EXISTS "webteb_foods" (
    "id" TEXT NOT NULL,
    "webteb_id" INTEGER NOT NULL,
    "category_id" TEXT NOT NULL,
    "category_slug" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "calories" INTEGER NOT NULL DEFAULT 0,
    "protein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "serving_units" JSONB NOT NULL DEFAULT '[]',
    "sections" JSONB NOT NULL DEFAULT '{}',
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webteb_foods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "webteb_foods_webteb_id_key" ON "webteb_foods"("webteb_id");
CREATE INDEX IF NOT EXISTS "webteb_foods_category_id_idx" ON "webteb_foods"("category_id");
CREATE INDEX IF NOT EXISTS "webteb_foods_name_ar_idx" ON "webteb_foods"("name_ar");

ALTER TABLE "webteb_foods" DROP CONSTRAINT IF EXISTS "webteb_foods_category_id_fkey";
ALTER TABLE "webteb_foods" ADD CONSTRAINT "webteb_foods_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "webteb_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
