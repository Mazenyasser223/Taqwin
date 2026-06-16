-- Add platform admin role for shop management.
DO $$
BEGIN
  ALTER TYPE "Role" ADD VALUE 'admin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
