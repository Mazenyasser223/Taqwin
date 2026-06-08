-- Separate community profile photo from main app profile photo.
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "community_avatar_url" TEXT;
