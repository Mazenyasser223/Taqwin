-- InBody upload + AI extraction fields on body_metrics
DO $$ BEGIN
  CREATE TYPE "InbodySource" AS ENUM ('manual', 'inbody_upload', 'ai_extracted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "body_metrics" ADD COLUMN IF NOT EXISTS "body_fat_mass_kg" DOUBLE PRECISION;
ALTER TABLE "body_metrics" ADD COLUMN IF NOT EXISTS "skeletal_muscle_mass_kg" DOUBLE PRECISION;
ALTER TABLE "body_metrics" ADD COLUMN IF NOT EXISTS "bmi" DOUBLE PRECISION;
ALTER TABLE "body_metrics" ADD COLUMN IF NOT EXISTS "basal_metabolic_rate" DOUBLE PRECISION;
ALTER TABLE "body_metrics" ADD COLUMN IF NOT EXISTS "visceral_fat_level" DOUBLE PRECISION;
ALTER TABLE "body_metrics" ADD COLUMN IF NOT EXISTS "waist_hip_ratio" DOUBLE PRECISION;
ALTER TABLE "body_metrics" ADD COLUMN IF NOT EXISTS "inbody_score" DOUBLE PRECISION;
ALTER TABLE "body_metrics" ADD COLUMN IF NOT EXISTS "target_weight_kg" DOUBLE PRECISION;
ALTER TABLE "body_metrics" ADD COLUMN IF NOT EXISTS "fat_control_kg" DOUBLE PRECISION;
ALTER TABLE "body_metrics" ADD COLUMN IF NOT EXISTS "muscle_control_kg" DOUBLE PRECISION;
ALTER TABLE "body_metrics" ADD COLUMN IF NOT EXISTS "report_url" TEXT;
ALTER TABLE "body_metrics" ADD COLUMN IF NOT EXISTS "source" "InbodySource" DEFAULT 'manual';
ALTER TABLE "body_metrics" ADD COLUMN IF NOT EXISTS "measured_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "body_metrics_user_measured_idx" ON "body_metrics"("user_id", "measured_at");
