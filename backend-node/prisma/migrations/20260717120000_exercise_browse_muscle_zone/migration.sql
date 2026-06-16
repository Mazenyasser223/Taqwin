-- One canonical muscle browse tile per exercise (no overlap between zones).
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "browse_muscle_zone" VARCHAR(32);

CREATE INDEX IF NOT EXISTS "exercises_browse_muscle_zone_idx" ON "exercises"("browse_muscle_zone");
