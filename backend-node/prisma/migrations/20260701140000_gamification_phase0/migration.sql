-- Phase 0 gamification: daily fitness scores + user gamification profile + settings flags

CREATE TABLE IF NOT EXISTS "athlete_daily_scores" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date_key" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "sleep_pts" DOUBLE PRECISION NOT NULL,
    "meals_pts" DOUBLE PRECISION NOT NULL,
    "water_pts" DOUBLE PRECISION NOT NULL,
    "workout_pts" DOUBLE PRECISION NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'cron',

    CONSTRAINT "athlete_daily_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "athlete_daily_scores_user_id_date_key_key"
  ON "athlete_daily_scores"("user_id", "date_key");
CREATE INDEX IF NOT EXISTS "athlete_daily_scores_date_key_score_idx"
  ON "athlete_daily_scores"("date_key", "score");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'athlete_daily_scores_user_id_fkey'
  ) THEN
    ALTER TABLE "athlete_daily_scores" ADD CONSTRAINT "athlete_daily_scores_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "user_gamification" (
    "user_id" TEXT NOT NULL,
    "current_tier" TEXT NOT NULL DEFAULT 'bronze',
    "lifetime_xp" INTEGER NOT NULL DEFAULT 0,
    "current_xp" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_gamification_pkey" PRIMARY KEY ("user_id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_gamification_user_id_fkey'
  ) THEN
    ALTER TABLE "user_gamification" ADD CONSTRAINT "user_gamification_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "league_opt_in" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "leaderboard_visibility" TEXT NOT NULL DEFAULT 'off';
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "show_on_leaderboard" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "challenge_notifications" BOOLEAN NOT NULL DEFAULT true;
