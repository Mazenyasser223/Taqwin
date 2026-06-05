-- Arabic display names for MuscleWiki exercises
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "name_ar" TEXT;

CREATE INDEX IF NOT EXISTS "exercises_name_ar_idx" ON "exercises"("name_ar");
