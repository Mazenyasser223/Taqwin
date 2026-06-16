CREATE INDEX IF NOT EXISTS "community_group_members_group_id_status_idx"
  ON "community_group_members" ("group_id", "status");

CREATE INDEX IF NOT EXISTS "community_groups_created_at_idx"
  ON "community_groups" ("created_at" DESC);
