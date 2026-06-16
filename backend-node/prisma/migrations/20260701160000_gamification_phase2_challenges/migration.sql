-- Phase 2 gamification: solo challenge templates + participants

CREATE TABLE IF NOT EXISTS "challenge_templates" (
    "slug" TEXT NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "metric" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "xp_reward" INTEGER NOT NULL,
    "badge_slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'flag',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "challenge_templates_pkey" PRIMARY KEY ("slug")
);

CREATE TABLE IF NOT EXISTS "challenge_participants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_slug" TEXT NOT NULL,
    "start_date_key" TEXT NOT NULL,
    "end_date_key" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "completed_at" TIMESTAMP(3),
    "xp_awarded" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_participants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "challenge_participants_user_id_status_idx"
  ON "challenge_participants"("user_id", "status");
CREATE INDEX IF NOT EXISTS "challenge_participants_template_slug_status_idx"
  ON "challenge_participants"("template_slug", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_participants_user_id_fkey') THEN
    ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_participants_template_slug_fkey') THEN
    ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_template_slug_fkey"
      FOREIGN KEY ("template_slug") REFERENCES "challenge_templates"("slug") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "challenge_templates" ("slug", "duration_days", "metric", "target", "xp_reward", "badge_slug", "icon", "sort_order", "active")
VALUES
  ('workout-7', 7, 'workout_days', 4, 100, 'challenge_workout_7', 'fitness_center', 1, true),
  ('hydration-7', 7, 'hydration_days', 5, 80, 'challenge_hydration_7', 'water_drop', 2, true),
  ('nutrition-14', 14, 'food_log_days', 10, 120, 'challenge_nutrition_14', 'restaurant', 3, true),
  ('score-7', 7, 'score_days', 5, 100, 'challenge_score_7', 'bolt', 4, true),
  ('gym-30', 30, 'gym_checkins', 8, 150, 'challenge_gym_30', 'location_city', 5, true),
  ('streak-7', 7, 'workout_streak', 5, 120, 'challenge_streak_7', 'local_fire_department', 6, true)
ON CONFLICT ("slug") DO NOTHING;
