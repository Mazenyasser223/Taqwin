-- Phase 1 gamification: weekly league seasons, memberships, achievements

CREATE TABLE IF NOT EXISTS "league_seasons" (
    "id" TEXT NOT NULL,
    "week_start" TEXT NOT NULL,
    "week_end" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_seasons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "league_seasons_week_start_key" ON "league_seasons"("week_start");

CREATE TABLE IF NOT EXISTS "league_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'bronze',
    "weekly_avg" INTEGER,
    "days_counted" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "promoted" BOOLEAN NOT NULL DEFAULT false,
    "demoted" BOOLEAN NOT NULL DEFAULT false,
    "xp_awarded" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "league_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "league_memberships_user_id_season_id_key"
  ON "league_memberships"("user_id", "season_id");
CREATE INDEX IF NOT EXISTS "league_memberships_season_id_tier_weekly_avg_idx"
  ON "league_memberships"("season_id", "tier", "weekly_avg");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'league_memberships_user_id_fkey') THEN
    ALTER TABLE "league_memberships" ADD CONSTRAINT "league_memberships_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'league_memberships_season_id_fkey') THEN
    ALTER TABLE "league_memberships" ADD CONSTRAINT "league_memberships_season_id_fkey"
      FOREIGN KEY ("season_id") REFERENCES "league_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "user_achievements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_achievements_user_id_slug_key"
  ON "user_achievements"("user_id", "slug");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_achievements_user_id_fkey') THEN
    ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
