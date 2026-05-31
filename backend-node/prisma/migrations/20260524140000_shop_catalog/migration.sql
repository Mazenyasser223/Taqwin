-- Shop catalog: categories + extended product fields

CREATE TABLE IF NOT EXISTS "shop_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT,
    "icon" TEXT,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "shop_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "shop_categories_slug_key" ON "shop_categories"("slug");
CREATE INDEX IF NOT EXISTS "shop_categories_parent_id_idx" ON "shop_categories"("parent_id");

DO $$ BEGIN
  ALTER TABLE "shop_categories"
    ADD CONSTRAINT "shop_categories_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "shop_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "name_ar" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category_id" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "compare_at_price" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EGP';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "discount_percent" INTEGER;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "price_min" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "price_max" DOUBLE PRECISION;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "has_variants" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "description_ar" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_on_sale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_key" ON "products"("slug");
CREATE INDEX IF NOT EXISTS "products_category_id_idx" ON "products"("category_id");
CREATE INDEX IF NOT EXISTS "products_brand_idx" ON "products"("brand");
CREATE INDEX IF NOT EXISTS "products_is_on_sale_idx" ON "products"("is_on_sale");
CREATE INDEX IF NOT EXISTS "products_is_active_idx" ON "products"("is_active");

DO $$ BEGIN
  ALTER TABLE "products"
    ADD CONSTRAINT "products_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "shop_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
