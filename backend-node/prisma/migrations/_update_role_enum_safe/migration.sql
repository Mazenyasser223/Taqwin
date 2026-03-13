-- Update Role enum: user → athlete, gym_owner → gym
-- Safe migration that updates existing data

-- Step 1: Update existing data
UPDATE users SET role = 'athlete' WHERE role = 'user';
UPDATE users SET role = 'gym' WHERE role = 'gym_owner';

-- Step 2: Create new enum with updated values
CREATE TYPE "Role_new" AS ENUM ('athlete', 'trainer', 'gym');

-- Step 3: Update column to use new enum
ALTER TABLE users ALTER COLUMN role TYPE "Role_new" USING (role::text::"Role_new");

-- Step 4: Drop old enum and rename new one
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
