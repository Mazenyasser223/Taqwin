-- Gym group classes (schedule, trainer, price)
CREATE TABLE IF NOT EXISTS "gym_classes" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "staff_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gym_classes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "gym_classes_gym_id_idx" ON "gym_classes"("gym_id");
CREATE INDEX IF NOT EXISTS "gym_classes_staff_id_idx" ON "gym_classes"("staff_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gym_classes_gym_id_fkey') THEN
    ALTER TABLE "gym_classes"
      ADD CONSTRAINT "gym_classes_gym_id_fkey"
      FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gym_classes_staff_id_fkey') THEN
    ALTER TABLE "gym_classes"
      ADD CONSTRAINT "gym_classes_staff_id_fkey"
      FOREIGN KEY ("staff_id") REFERENCES "gym_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
