-- Legacy profiles table removed by split_profiles; drop if recreated out-of-band.
DROP TABLE IF EXISTS "profiles";

-- Repair drift: user_settings existed without share_with_trainers on some DBs
ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "share_with_trainers" BOOLEAN NOT NULL DEFAULT true;
