-- Repair drift: Role enum must include trainer (Prisma schema + app code expect it).
DO $$
BEGIN
  ALTER TYPE "Role" ADD VALUE 'trainer';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
