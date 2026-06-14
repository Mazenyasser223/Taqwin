-- Gym equipment inventory with maintenance and cleaning status
CREATE TABLE IF NOT EXISTS "gym_equipment" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_ar" TEXT,
    "image_url" TEXT,
    "last_maintenance_at" TIMESTAMP(3),
    "next_maintenance_at" TIMESTAMP(3),
    "last_cleaned_at" TIMESTAMP(3),
    "maintenance_interval_days" INTEGER NOT NULL DEFAULT 90,
    "needs_maintenance" BOOLEAN NOT NULL DEFAULT false,
    "needs_cleaning" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_equipment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "gym_equipment_gym_id_needs_maintenance_needs_cleaning_idx"
    ON "gym_equipment"("gym_id", "needs_maintenance", "needs_cleaning");

ALTER TABLE "gym_equipment" DROP CONSTRAINT IF EXISTS "gym_equipment_gym_id_fkey";
ALTER TABLE "gym_equipment"
    ADD CONSTRAINT "gym_equipment_gym_id_fkey"
    FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
