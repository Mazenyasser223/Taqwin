-- AI Commerce: recommendation events, product ranking fields, order commerce metadata

CREATE TYPE "RecommendationEventType" AS ENUM (
  'shown',
  'clicked',
  'bundle_added',
  'purchased',
  'dismissed'
);

CREATE TABLE "recommendation_events" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id" TEXT,
  "event_type" "RecommendationEventType" NOT NULL,
  "source" TEXT NOT NULL,
  "bundle_id" TEXT,
  "product_id" TEXT,
  "product_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "session_id" TEXT,
  "order_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recommendation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recommendation_events_user_id_idx" ON "recommendation_events"("user_id");
CREATE INDEX "recommendation_events_event_type_idx" ON "recommendation_events"("event_type");
CREATE INDEX "recommendation_events_created_at_idx" ON "recommendation_events"("created_at");
CREATE INDEX "recommendation_events_session_id_idx" ON "recommendation_events"("session_id");
CREATE INDEX "recommendation_events_product_id_idx" ON "recommendation_events"("product_id");

ALTER TABLE "recommendation_events"
  ADD CONSTRAINT "recommendation_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recommendation_events"
  ADD CONSTRAINT "recommendation_events_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "recommendation_events"
  ADD CONSTRAINT "recommendation_events_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "cost_price" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "avg_rating" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sales_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "commerce_source" TEXT,
  ADD COLUMN IF NOT EXISTS "commerce_session_id" TEXT,
  ADD COLUMN IF NOT EXISTS "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
