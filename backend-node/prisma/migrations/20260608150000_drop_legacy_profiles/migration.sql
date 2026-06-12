-- Remove legacy profiles table recreated by an out-of-band repair migration.
-- App uses athlete_profiles + gym_profiles only.
-- On fresh DBs, split_profiles already dropped profiles — sync only when it still exists.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    INSERT INTO "athlete_profiles" (
      "id", "user_id", "display_name", "avatar_url", "cover_url", "date_of_birth", "gender",
      "height", "weight", "fitness_goal", "fitness_level", "medical_notes", "onboarding_data",
      "created_at", "updated_at"
    )
    SELECT
      p."id", p."user_id", p."display_name", p."avatar_url", p."cover_url", p."date_of_birth", p."gender",
      p."height", p."weight", p."fitness_goal", p."fitness_level", p."medical_notes", p."onboarding_data",
      p."created_at", p."updated_at"
    FROM "profiles" p
    JOIN "users" u ON u."id" = p."user_id"
    WHERE u."role" = 'athlete'
    ON CONFLICT ("user_id") DO UPDATE SET
      "display_name" = EXCLUDED."display_name",
      "avatar_url" = EXCLUDED."avatar_url",
      "cover_url" = EXCLUDED."cover_url",
      "updated_at" = EXCLUDED."updated_at";

    INSERT INTO "gym_profiles" (
      "id", "user_id", "display_name", "avatar_url", "cover_url", "bio",
      "business_name", "business_address", "business_phone", "website_url",
      "created_at", "updated_at"
    )
    SELECT
      p."id", p."user_id", p."display_name", p."avatar_url", p."cover_url", p."bio",
      p."business_name", p."business_address", p."business_phone", p."website_url",
      p."created_at", p."updated_at"
    FROM "profiles" p
    JOIN "users" u ON u."id" = p."user_id"
    WHERE u."role" = 'gym'
    ON CONFLICT ("user_id") DO UPDATE SET
      "display_name" = EXCLUDED."display_name",
      "avatar_url" = EXCLUDED."avatar_url",
      "cover_url" = EXCLUDED."cover_url",
      "updated_at" = EXCLUDED."updated_at";
  END IF;
END $$;

DROP TABLE IF EXISTS "profiles";
