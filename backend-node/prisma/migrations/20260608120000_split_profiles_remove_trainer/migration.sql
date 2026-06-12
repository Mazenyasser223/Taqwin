-- Split profiles into athlete_profiles + gym_profiles; remove trainer role and bookings.

-- 1. New profile tables
CREATE TABLE "athlete_profiles" (
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
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "athlete_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gym_profiles" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "display_name" TEXT,
  "avatar_url" TEXT,
  "cover_url" TEXT,
  "bio" TEXT,
  "business_name" TEXT,
  "business_address" TEXT,
  "business_phone" TEXT,
  "website_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gym_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "athlete_profiles_user_id_key" ON "athlete_profiles"("user_id");
CREATE UNIQUE INDEX "gym_profiles_user_id_key" ON "gym_profiles"("user_id");

ALTER TABLE "athlete_profiles"
  ADD CONSTRAINT "athlete_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "gym_profiles"
  ADD CONSTRAINT "gym_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Migrate existing profile rows by role
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
WHERE u."role" = 'athlete';

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
WHERE u."role" = 'gym';

-- Trainer accounts: migrate any leftover profile data to athlete_profiles before deletion
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
WHERE u."role" = 'trainer'
ON CONFLICT ("user_id") DO NOTHING;

-- 3. Remove trainer bookings and trainer users (cascade removes related rows)
DROP TABLE IF EXISTS "trainer_bookings";

DELETE FROM "users" WHERE "role" = 'trainer';

-- 4. Drop legacy profiles table
DROP TABLE "profiles";

-- 5. Remove trainer-specific settings column
ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "share_with_trainers";

-- 6. Update Role enum (athlete | gym only)
CREATE TYPE "Role_new" AS ENUM ('athlete', 'gym');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE "role"::text
      WHEN 'gym' THEN 'gym'::"Role_new"
      ELSE 'athlete'::"Role_new"
    END
  );
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'athlete';
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

-- 7. Drop unused booking enum
DROP TYPE IF EXISTS "BookingStatus";
