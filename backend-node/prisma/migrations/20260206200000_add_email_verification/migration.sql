-- AlterTable
ALTER TABLE "users" 
  ADD COLUMN "verification_code" TEXT,
  ADD COLUMN "verification_code_expiry" TIMESTAMP(3);
