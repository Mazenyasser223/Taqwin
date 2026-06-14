-- Gym public listing: photo gallery, promo video, opening hours
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "gallery_urls" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "video_url" TEXT;
ALTER TABLE "gyms" ADD COLUMN IF NOT EXISTS "working_hours" JSONB NOT NULL DEFAULT '[]';
