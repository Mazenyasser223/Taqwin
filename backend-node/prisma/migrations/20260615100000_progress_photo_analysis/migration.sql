-- Progress photo pose + AI analysis (body validation, posture notes)
DO $$ BEGIN
  CREATE TYPE "ProgressPhotoPose" AS ENUM ('front', 'side', 'back');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "progress_photos" ADD COLUMN IF NOT EXISTS "pose" "ProgressPhotoPose";
ALTER TABLE "progress_photos" ADD COLUMN IF NOT EXISTS "analysis" JSONB;

CREATE INDEX IF NOT EXISTS "progress_photos_user_id_pose_idx" ON "progress_photos"("user_id", "pose");
