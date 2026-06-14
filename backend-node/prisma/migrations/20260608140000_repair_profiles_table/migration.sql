-- Repair: profiles table missing on some Supabase databases (blocks login).
CREATE TABLE IF NOT EXISTS "profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "cover_url" TEXT,
    "date_of_birth" DATE,
    "gender" TEXT,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "fitness_goal" TEXT,
    "fitness_level" TEXT,
    "medical_notes" TEXT,
    "onboarding_data" JSONB,
    "bio" TEXT,
    "specialties" TEXT,
    "years_experience" INTEGER,
    "business_name" TEXT,
    "business_address" TEXT,
    "business_phone" TEXT,
    "website_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "profiles_user_id_key" ON "profiles"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_fkey'
  ) THEN
    ALTER TABLE "profiles"
      ADD CONSTRAINT "profiles_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill empty profiles for existing users
INSERT INTO "profiles" ("id", "user_id", "created_at", "updated_at")
SELECT gen_random_uuid()::text, u."id", NOW(), NOW()
FROM "users" u
LEFT JOIN "profiles" p ON p."user_id" = u."id"
WHERE p."id" IS NULL;
