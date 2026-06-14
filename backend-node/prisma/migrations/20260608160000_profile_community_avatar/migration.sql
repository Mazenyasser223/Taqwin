-- Separate community profile photo from main app profile photo.
ALTER TABLE "athlete_profiles" ADD COLUMN IF NOT EXISTS "community_avatar_url" TEXT;
ALTER TABLE "gym_profiles" ADD COLUMN IF NOT EXISTS "community_avatar_url" TEXT;
