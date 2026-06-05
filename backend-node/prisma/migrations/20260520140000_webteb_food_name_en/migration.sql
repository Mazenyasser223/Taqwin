-- English display names for WebTeb foods (UI + search)
ALTER TABLE "webteb_foods" ADD COLUMN IF NOT EXISTS "name_en" TEXT;

CREATE INDEX IF NOT EXISTS "webteb_foods_name_en_idx" ON "webteb_foods"("name_en");
