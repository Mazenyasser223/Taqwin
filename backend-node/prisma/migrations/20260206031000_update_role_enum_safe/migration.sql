-- Update Role enum safely:
-- old enum values: user, trainer, gym_owner
-- new enum values: athlete, trainer, gym

-- Step 1: Create new enum with updated values
CREATE TYPE "Role_new" AS ENUM ('athlete', 'trainer', 'gym');

-- Step 2: Convert existing values while changing the column type.
-- Handles both legacy values (user/gym_owner) and any users already created with
-- the new values (athlete/trainer/gym). Anything unknown falls back to 'athlete'.
ALTER TABLE users
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE "Role_new"
  USING (
    CASE role::text
      WHEN 'user' THEN 'athlete'
      WHEN 'athlete' THEN 'athlete'
      WHEN 'trainer' THEN 'trainer'
      WHEN 'gym_owner' THEN 'gym'
      WHEN 'gym' THEN 'gym'
      ELSE 'athlete'
    END::"Role_new"
  );

-- Step 3: Replace old enum type and restore default
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'athlete';
