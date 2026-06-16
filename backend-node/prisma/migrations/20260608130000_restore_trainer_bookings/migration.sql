-- Restore BookingStatus enum + trainer_bookings (removed by remote split migration)
DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "trainer_bookings" (
  "id"           TEXT PRIMARY KEY,
  "athlete_id"   TEXT NOT NULL,
  "trainer_id"   TEXT NOT NULL,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "status"       "BookingStatus" NOT NULL DEFAULT 'pending',
  "notes"        TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trainer_bookings_athlete_fk" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "trainer_bookings_trainer_fk" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "trainer_bookings_athlete_idx" ON "trainer_bookings"("athlete_id", "scheduled_at");
CREATE INDEX IF NOT EXISTS "trainer_bookings_trainer_idx" ON "trainer_bookings"("trainer_id", "scheduled_at");
