-- Track whether the Taqwin account was created at gym reception (vs existing user joined).

ALTER TABLE "gym_memberships"
ADD COLUMN IF NOT EXISTS "account_created_at_desk" BOOLEAN NOT NULL DEFAULT false;
