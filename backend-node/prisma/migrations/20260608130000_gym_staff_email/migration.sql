-- AlterTable
ALTER TABLE "gym_staff" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE INDEX "gym_staff_gym_id_email_idx" ON "gym_staff"("gym_id", "email");
