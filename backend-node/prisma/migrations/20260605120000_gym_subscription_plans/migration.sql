-- Gym subscription plans + membership payment fields

CREATE TABLE IF NOT EXISTS "gym_subscription_plans" (
  "id"             TEXT PRIMARY KEY,
  "gym_id"         TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "name_ar"        TEXT,
  "duration_days"  INTEGER NOT NULL,
  "price"          DOUBLE PRECISION NOT NULL,
  "currency"       TEXT NOT NULL DEFAULT 'EGP',
  "description"    TEXT,
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "sort_order"     INTEGER NOT NULL DEFAULT 0,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gym_subscription_plans_gym_fk"
    FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "gym_subscription_plans_gym_id_is_active_sort_order_idx"
  ON "gym_subscription_plans"("gym_id", "is_active", "sort_order");

ALTER TABLE "gym_memberships" ADD COLUMN IF NOT EXISTS "plan_id" TEXT;
ALTER TABLE "gym_memberships" ADD COLUMN IF NOT EXISTS "paid_amount" DOUBLE PRECISION;
ALTER TABLE "gym_memberships" ADD COLUMN IF NOT EXISTS "payment_method" TEXT;
ALTER TABLE "gym_memberships" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);

ALTER TABLE "gym_memberships" DROP CONSTRAINT IF EXISTS "gym_memberships_plan_id_fkey";
ALTER TABLE "gym_memberships" ADD CONSTRAINT "gym_memberships_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "gym_subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
