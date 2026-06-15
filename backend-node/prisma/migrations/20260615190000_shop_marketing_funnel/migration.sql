-- Marketing layer, conversion funnel, admin audit

CREATE TYPE "ShopFunnelStep" AS ENUM (
  'visit',
  'search',
  'product_view',
  'add_to_cart',
  'checkout_start',
  'paid'
);

CREATE TYPE "CouponType" AS ENUM ('percent', 'fixed');

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "coupon_code" TEXT,
  ADD COLUMN IF NOT EXISTS "loyalty_points_used" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "shop_funnel_events" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT,
  "session_id" TEXT NOT NULL,
  "step" "ShopFunnelStep" NOT NULL,
  "product_id" TEXT,
  "query" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shop_funnel_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shop_funnel_events_step_idx" ON "shop_funnel_events"("step");
CREATE INDEX "shop_funnel_events_session_id_idx" ON "shop_funnel_events"("session_id");
CREATE INDEX "shop_funnel_events_created_at_idx" ON "shop_funnel_events"("created_at");
CREATE INDEX "shop_funnel_events_user_id_idx" ON "shop_funnel_events"("user_id");

ALTER TABLE "shop_funnel_events"
  ADD CONSTRAINT "shop_funnel_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "shop_coupons" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL,
  "type" "CouponType" NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "min_order_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "max_uses" INTEGER,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "per_user_limit" INTEGER NOT NULL DEFAULT 1,
  "starts_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "description_en" TEXT,
  "description_ar" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shop_coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shop_coupons_code_key" ON "shop_coupons"("code");

CREATE TABLE "shop_coupon_redemptions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "coupon_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "order_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shop_coupon_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shop_coupon_redemptions_coupon_id_idx" ON "shop_coupon_redemptions"("coupon_id");
CREATE INDEX "shop_coupon_redemptions_user_id_idx" ON "shop_coupon_redemptions"("user_id");

ALTER TABLE "shop_coupon_redemptions"
  ADD CONSTRAINT "shop_coupon_redemptions_coupon_id_fkey"
  FOREIGN KEY ("coupon_id") REFERENCES "shop_coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shop_coupon_redemptions"
  ADD CONSTRAINT "shop_coupon_redemptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "referral_codes" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_codes_user_id_key" ON "referral_codes"("user_id");
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

ALTER TABLE "referral_codes"
  ADD CONSTRAINT "referral_codes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "referral_invites" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "referrer_id" TEXT NOT NULL,
  "referee_id" TEXT,
  "referee_email" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "points_awarded" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "referral_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_invites_referee_id_key" ON "referral_invites"("referee_id");
CREATE INDEX "referral_invites_referrer_id_idx" ON "referral_invites"("referrer_id");

ALTER TABLE "referral_invites"
  ADD CONSTRAINT "referral_invites_referrer_id_fkey"
  FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "referral_invites"
  ADD CONSTRAINT "referral_invites_referee_id_fkey"
  FOREIGN KEY ("referee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "loyalty_accounts" (
  "user_id" TEXT NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 0,
  "lifetime_points" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "loyalty_accounts"
  ADD CONSTRAINT "loyalty_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "loyalty_transactions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "order_id" TEXT,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "loyalty_transactions_user_id_idx" ON "loyalty_transactions"("user_id");

ALTER TABLE "loyalty_transactions"
  ADD CONSTRAINT "loyalty_transactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "admin_audit_logs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "admin_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entity_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_logs_admin_id_idx" ON "admin_audit_logs"("admin_id");
CREATE INDEX "admin_audit_logs_entity_idx" ON "admin_audit_logs"("entity");
CREATE INDEX "admin_audit_logs_created_at_idx" ON "admin_audit_logs"("created_at");

ALTER TABLE "admin_audit_logs"
  ADD CONSTRAINT "admin_audit_logs_admin_id_fkey"
  FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "shop_coupons" ("code", "type", "value", "min_order_total", "max_uses", "per_user_limit", "description_en", "description_ar", "is_active")
VALUES
  ('WELCOME10', 'percent', 10, 200, 10000, 1, '10% off your first order', 'خصم 10% على أول طلب', true),
  ('RAMADAN20', 'percent', 20, 500, 5000, 3, '20% Ramadan offer', 'عرض رمضان 20%', true),
  ('COACH15', 'percent', 15, 300, NULL, 5, '15% off for coached athletes', 'خصم 15% للرياضيين', true)
ON CONFLICT ("code") DO NOTHING;
