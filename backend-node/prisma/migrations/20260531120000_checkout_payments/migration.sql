-- Checkout: shipping fields, payments, extended order status

CREATE TYPE "PaymentMethod" AS ENUM ('cod', 'card', 'fawry', 'wallet');
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'processing', 'paid', 'failed', 'refunded');

ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'pending_payment';

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "subtotal" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_fee" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EGP';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" "PaymentMethod";
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_governorate" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_city" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_address" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_phone" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_number" TEXT;

UPDATE "orders" SET "subtotal" = "total" WHERE "subtotal" IS NULL;
ALTER TABLE "orders" ALTER COLUMN "subtotal" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "orders_user_created_idx" ON "orders"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "payments" (
  "id" TEXT PRIMARY KEY,
  "order_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "external_id" TEXT,
  "metadata" JSONB,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payments_order_fk" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "payments_order_idx" ON "payments"("order_id");
CREATE INDEX IF NOT EXISTS "payments_external_id_idx" ON "payments"("external_id");
