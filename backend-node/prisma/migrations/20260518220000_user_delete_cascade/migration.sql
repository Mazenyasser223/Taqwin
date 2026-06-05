-- Cascade delete when a user is removed: owned gyms and created workouts.

ALTER TABLE "gyms" DROP CONSTRAINT IF EXISTS "gyms_owner_fk";
ALTER TABLE "gyms"
  ADD CONSTRAINT "gyms_owner_fk"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workouts" DROP CONSTRAINT IF EXISTS "workouts_creator_fk";
ALTER TABLE "workouts"
  ADD CONSTRAINT "workouts_creator_fk"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
