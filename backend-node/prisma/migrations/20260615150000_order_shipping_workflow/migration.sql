-- Order shipping workflow: fulfillment statuses + tracking fields

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'packed';

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_number" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "carrier" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipped_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3);
