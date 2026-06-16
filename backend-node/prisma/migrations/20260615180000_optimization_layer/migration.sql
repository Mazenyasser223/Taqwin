-- Optimization Layer: reviews, wishlist, subscriptions, feedback events

ALTER TYPE "RecommendationEventType" ADD VALUE IF NOT EXISTS 'feedback_positive';
ALTER TYPE "RecommendationEventType" ADD VALUE IF NOT EXISTS 'feedback_negative';

CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'paused', 'cancelled');

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "review_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "wishlist_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "product_reviews" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "product_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "order_id" TEXT,
  "rating" INTEGER NOT NULL,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "is_verified_purchase" BOOLEAN NOT NULL DEFAULT false,
  "helpful_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_reviews_product_id_user_id_key" ON "product_reviews"("product_id", "user_id");
CREATE INDEX "product_reviews_product_id_idx" ON "product_reviews"("product_id");

ALTER TABLE "product_reviews"
  ADD CONSTRAINT "product_reviews_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_reviews"
  ADD CONSTRAINT "product_reviews_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_reviews"
  ADD CONSTRAINT "product_reviews_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "review_votes" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "review_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "helpful" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "review_votes_review_id_user_id_key" ON "review_votes"("review_id", "user_id");

ALTER TABLE "review_votes"
  ADD CONSTRAINT "review_votes_review_id_fkey"
  FOREIGN KEY ("review_id") REFERENCES "product_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_votes"
  ADD CONSTRAINT "review_votes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "product_wishlists" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_wishlists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_wishlists_user_id_product_id_key" ON "product_wishlists"("user_id", "product_id");
CREATE INDEX "product_wishlists_product_id_idx" ON "product_wishlists"("product_id");

ALTER TABLE "product_wishlists"
  ADD CONSTRAINT "product_wishlists_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_wishlists"
  ADD CONSTRAINT "product_wishlists_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "product_subscriptions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "interval_days" INTEGER NOT NULL DEFAULT 30,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
  "next_delivery_at" TIMESTAMP(3) NOT NULL,
  "last_order_id" TEXT,
  "paused_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_subscriptions_user_id_idx" ON "product_subscriptions"("user_id");
CREATE INDEX "product_subscriptions_next_delivery_at_idx" ON "product_subscriptions"("next_delivery_at");
CREATE INDEX "product_subscriptions_status_idx" ON "product_subscriptions"("status");

ALTER TABLE "product_subscriptions"
  ADD CONSTRAINT "product_subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_subscriptions"
  ADD CONSTRAINT "product_subscriptions_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
