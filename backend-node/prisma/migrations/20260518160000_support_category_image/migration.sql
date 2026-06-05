-- CreateEnum
CREATE TYPE "SupportTicketCategory" AS ENUM ('account', 'booking', 'membership', 'payments', 'technical', 'other');

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN "category" "SupportTicketCategory" NOT NULL DEFAULT 'other';
ALTER TABLE "support_tickets" ADD COLUMN "image_url" TEXT;
