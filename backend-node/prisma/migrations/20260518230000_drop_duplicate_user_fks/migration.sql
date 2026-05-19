-- Remove duplicate FK constraints that still use RESTRICT/SET NULL on user_id references.
-- Prisma migration added gyms_owner_fk (CASCADE) but gyms_owner_id_fkey (RESTRICT) remained.

ALTER TABLE "gyms" DROP CONSTRAINT IF EXISTS "gyms_owner_id_fkey";

ALTER TABLE "workouts" DROP CONSTRAINT IF EXISTS "workouts_created_by_id_fkey";
