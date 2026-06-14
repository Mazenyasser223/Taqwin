-- Bookings for gym group classes (reception desk)
CREATE TYPE "GymClassBookingStatus" AS ENUM ('booked', 'cancelled', 'attended');

CREATE TABLE IF NOT EXISTS "gym_class_bookings" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "paid_amount" DOUBLE PRECISION NOT NULL,
    "payment_method" TEXT NOT NULL,
    "status" "GymClassBookingStatus" NOT NULL DEFAULT 'booked',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gym_class_bookings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "gym_class_bookings_gym_id_idx" ON "gym_class_bookings"("gym_id");
CREATE INDEX IF NOT EXISTS "gym_class_bookings_class_id_idx" ON "gym_class_bookings"("class_id");
CREATE INDEX IF NOT EXISTS "gym_class_bookings_user_id_idx" ON "gym_class_bookings"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "gym_class_bookings_class_user_session_key"
  ON "gym_class_bookings"("class_id", "user_id", "session_date");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gym_class_bookings_gym_id_fkey') THEN
    ALTER TABLE "gym_class_bookings"
      ADD CONSTRAINT "gym_class_bookings_gym_id_fkey"
      FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gym_class_bookings_class_id_fkey') THEN
    ALTER TABLE "gym_class_bookings"
      ADD CONSTRAINT "gym_class_bookings_class_id_fkey"
      FOREIGN KEY ("class_id") REFERENCES "gym_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gym_class_bookings_user_id_fkey') THEN
    ALTER TABLE "gym_class_bookings"
      ADD CONSTRAINT "gym_class_bookings_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
