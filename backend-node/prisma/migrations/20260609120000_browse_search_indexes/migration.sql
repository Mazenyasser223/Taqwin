-- Faster community browse search by display name (split profile tables)
CREATE INDEX IF NOT EXISTS "athlete_profiles_display_name_idx"
  ON "athlete_profiles" ("display_name");

CREATE INDEX IF NOT EXISTS "gym_profiles_display_name_idx"
  ON "gym_profiles" ("display_name");

CREATE INDEX IF NOT EXISTS "users_role_created_at_idx"
  ON "users" ("role", "created_at" DESC);
