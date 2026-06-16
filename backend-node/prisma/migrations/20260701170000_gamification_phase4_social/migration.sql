-- Phase 4 gamification: head-to-head duels + squad challenges

ALTER TABLE "challenge_participants" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'solo';
ALTER TABLE "challenge_participants" ADD COLUMN IF NOT EXISTS "duel_id" TEXT;
ALTER TABLE "challenge_participants" ADD COLUMN IF NOT EXISTS "squad_id" TEXT;

CREATE INDEX IF NOT EXISTS "challenge_participants_duel_id_idx" ON "challenge_participants"("duel_id");
CREATE INDEX IF NOT EXISTS "challenge_participants_squad_id_idx" ON "challenge_participants"("squad_id");

CREATE TABLE IF NOT EXISTS "challenge_duels" (
    "id" TEXT NOT NULL,
    "template_slug" TEXT NOT NULL,
    "challenger_id" TEXT NOT NULL,
    "opponent_id" TEXT NOT NULL,
    "challenger_participant_id" TEXT,
    "opponent_participant_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "winner_id" TEXT,
    "start_date_key" TEXT,
    "end_date_key" TEXT,
    "target" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_duels_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "challenge_duels_challenger_id_status_idx"
  ON "challenge_duels"("challenger_id", "status");
CREATE INDEX IF NOT EXISTS "challenge_duels_opponent_id_status_idx"
  ON "challenge_duels"("opponent_id", "status");

CREATE TABLE IF NOT EXISTS "challenge_squads" (
    "id" TEXT NOT NULL,
    "template_slug" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'recruiting',
    "max_members" INTEGER NOT NULL DEFAULT 5,
    "start_date_key" TEXT,
    "end_date_key" TEXT,
    "target" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenge_squads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "challenge_squads_owner_id_status_idx"
  ON "challenge_squads"("owner_id", "status");
CREATE INDEX IF NOT EXISTS "challenge_squads_template_slug_status_idx"
  ON "challenge_squads"("template_slug", "status");

CREATE TABLE IF NOT EXISTS "challenge_squad_members" (
    "id" TEXT NOT NULL,
    "squad_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_squad_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "challenge_squad_members_squad_id_user_id_key"
  ON "challenge_squad_members"("squad_id", "user_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_participants_duel_id_fkey') THEN
    ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_duel_id_fkey"
      FOREIGN KEY ("duel_id") REFERENCES "challenge_duels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_participants_squad_id_fkey') THEN
    ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_squad_id_fkey"
      FOREIGN KEY ("squad_id") REFERENCES "challenge_squads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_duels_challenger_id_fkey') THEN
    ALTER TABLE "challenge_duels" ADD CONSTRAINT "challenge_duels_challenger_id_fkey"
      FOREIGN KEY ("challenger_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_duels_opponent_id_fkey') THEN
    ALTER TABLE "challenge_duels" ADD CONSTRAINT "challenge_duels_opponent_id_fkey"
      FOREIGN KEY ("opponent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_squads_owner_id_fkey') THEN
    ALTER TABLE "challenge_squads" ADD CONSTRAINT "challenge_squads_owner_id_fkey"
      FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_squad_members_squad_id_fkey') THEN
    ALTER TABLE "challenge_squad_members" ADD CONSTRAINT "challenge_squad_members_squad_id_fkey"
      FOREIGN KEY ("squad_id") REFERENCES "challenge_squads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'challenge_squad_members_user_id_fkey') THEN
    ALTER TABLE "challenge_squad_members" ADD CONSTRAINT "challenge_squad_members_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
