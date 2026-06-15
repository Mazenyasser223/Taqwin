-- Order payment tracking for Paymob checkout flow
DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "payment_provider" TEXT,
  ADD COLUMN IF NOT EXISTS "payment_reference" TEXT,
  ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "orders_payment_status_idx" ON "orders"("payment_status");
CREATE INDEX IF NOT EXISTS "orders_payment_reference_idx" ON "orders"("payment_reference");

-- Existing orders were created without a gateway — treat as paid reservations
UPDATE "orders"
SET "payment_status" = 'paid', "paid_at" = COALESCE("paid_at", "created_at")
WHERE "payment_status" = 'pending'
  AND "payment_provider" IS NULL;
