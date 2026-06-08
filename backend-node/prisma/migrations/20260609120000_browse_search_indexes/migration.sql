-- Faster community browse search by display name
CREATE INDEX IF NOT EXISTS "profiles_display_name_idx"
  ON "profiles" ("display_name");

CREATE INDEX IF NOT EXISTS "users_role_created_at_idx"
  ON "users" ("role", "created_at" DESC);
