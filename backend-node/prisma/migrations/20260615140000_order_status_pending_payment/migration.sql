-- Sync Prisma OrderStatus with PostgreSQL (pending_payment used by Paymob checkout flow)
DO $$ BEGIN
  ALTER TYPE "OrderStatus" ADD VALUE 'pending_payment';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
