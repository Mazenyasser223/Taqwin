-- Set default order status after pending_payment enum value exists (separate transaction).
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending_payment';
