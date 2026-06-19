-- Performance indexes for gamification league + social queries

CREATE INDEX IF NOT EXISTS "gym_memberships_user_id_is_active_idx"
  ON "gym_memberships"("user_id", "is_active");

CREATE INDEX IF NOT EXISTS "challenge_squad_members_user_id_idx"
  ON "challenge_squad_members"("user_id");

CREATE INDEX IF NOT EXISTS "challenge_duels_status_end_date_key_idx"
  ON "challenge_duels"("status", "end_date_key");

CREATE INDEX IF NOT EXISTS "challenge_squads_status_end_date_key_idx"
  ON "challenge_squads"("status", "end_date_key");

CREATE INDEX IF NOT EXISTS "community_follows_follower_id_status_idx"
  ON "community_follows"("follower_id", "status");

CREATE INDEX IF NOT EXISTS "community_follows_following_id_status_idx"
  ON "community_follows"("following_id", "status");
