-- Athlete community bio (parity with gym_profiles.bio)
ALTER TABLE "athlete_profiles" ADD COLUMN IF NOT EXISTS "bio" TEXT;
