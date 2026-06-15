-- Reception: check-out time + staff who registered the visit
ALTER TABLE "gym_check_ins" ADD COLUMN IF NOT EXISTS "checked_out_at" TIMESTAMP(3);
ALTER TABLE "gym_check_ins" ADD COLUMN IF NOT EXISTS "registered_by_id" TEXT;

ALTER TABLE "gym_check_ins" DROP CONSTRAINT IF EXISTS "gym_check_ins_registered_by_id_fkey";
ALTER TABLE "gym_check_ins" ADD CONSTRAINT "gym_check_ins_registered_by_id_fkey"
  FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "gym_check_ins_gym_id_checked_in_at_idx" ON "gym_check_ins"("gym_id", "checked_in_at");
CREATE INDEX IF NOT EXISTS "gym_check_ins_gym_id_user_id_checked_out_at_idx" ON "gym_check_ins"("gym_id", "user_id", "checked_out_at");
