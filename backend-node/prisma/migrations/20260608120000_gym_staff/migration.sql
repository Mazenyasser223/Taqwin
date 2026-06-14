-- CreateEnum
CREATE TYPE "GymStaffRole" AS ENUM ('trainer', 'receptionist', 'cleaner', 'other');

-- CreateEnum
CREATE TYPE "GymStaffPayoutType" AS ENUM ('salary', 'bonus');

-- CreateEnum
CREATE TYPE "GymStaffPayoutStatus" AS ENUM ('pending', 'paid', 'failed');

-- CreateEnum
CREATE TYPE "GymStaffPayoutProvider" AS ENUM ('mock', 'paymob', 'manual', 'cash');

-- CreateTable
CREATE TABLE "gym_staff" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "GymStaffRole" NOT NULL DEFAULT 'other',
    "base_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "working_hours" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "hired_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_staff_payouts" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "type" "GymStaffPayoutType" NOT NULL,
    "base_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonus_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "period_month" INTEGER,
    "period_year" INTEGER,
    "status" "GymStaffPayoutStatus" NOT NULL DEFAULT 'pending',
    "provider" "GymStaffPayoutProvider" NOT NULL DEFAULT 'mock',
    "external_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_staff_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gym_staff_gym_id_is_active_role_idx" ON "gym_staff"("gym_id", "is_active", "role");

-- CreateIndex
CREATE INDEX "gym_staff_payouts_gym_id_period_year_period_month_idx" ON "gym_staff_payouts"("gym_id", "period_year", "period_month");

-- CreateIndex
CREATE INDEX "gym_staff_payouts_staff_id_created_at_idx" ON "gym_staff_payouts"("staff_id", "created_at");

-- CreateIndex (one salary payout per staff per month)
CREATE UNIQUE INDEX "gym_staff_payouts_salary_period_unique"
ON "gym_staff_payouts"("staff_id", "period_month", "period_year")
WHERE "type" = 'salary';

-- AddForeignKey
ALTER TABLE "gym_staff" ADD CONSTRAINT "gym_staff_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_staff_payouts" ADD CONSTRAINT "gym_staff_payouts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "gym_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
