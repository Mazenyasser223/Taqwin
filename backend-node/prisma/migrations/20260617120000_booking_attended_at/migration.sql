-- Track when reception confirms attendance so session revenue lands in the correct month.
ALTER TABLE "gym_class_bookings" ADD COLUMN "attended_at" TIMESTAMP(3);
ALTER TABLE "gym_basic_session_bookings" ADD COLUMN "attended_at" TIMESTAMP(3);

UPDATE "gym_class_bookings"
SET "attended_at" = "created_at"
WHERE "status" = 'attended' AND "attended_at" IS NULL;

UPDATE "gym_basic_session_bookings"
SET "attended_at" = "created_at"
WHERE "status" = 'attended' AND "attended_at" IS NULL;

CREATE INDEX "gym_class_bookings_gym_id_attended_at_idx" ON "gym_class_bookings"("gym_id", "attended_at");
CREATE INDEX "gym_basic_session_bookings_gym_id_attended_at_idx" ON "gym_basic_session_bookings"("gym_id", "attended_at");
