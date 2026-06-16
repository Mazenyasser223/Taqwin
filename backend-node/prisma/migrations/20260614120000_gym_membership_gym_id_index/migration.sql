-- Speed up gym-scoped membership lists (reception, dashboard).
CREATE INDEX IF NOT EXISTS "gym_memberships_gym_id_idx" ON "gym_memberships"("gym_id");
