-- Domain build-out: gyms, workouts, nutrition, marketplace, bookings,
-- community, notifications, password reset.

-- =============================================================================
-- Enums
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- Users: password reset
-- =============================================================================
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_reset_token"  TEXT,
  ADD COLUMN IF NOT EXISTS "password_reset_expiry" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_password_reset_token_key"
  ON "users" ("password_reset_token");

-- =============================================================================
-- Gyms
-- =============================================================================
CREATE TABLE IF NOT EXISTS "gyms" (
  "id"           TEXT PRIMARY KEY,
  "owner_id"     TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "location"     TEXT NOT NULL,
  "bio"          TEXT,
  "image_url"    TEXT,
  "phone"        TEXT,
  "max_capacity" INTEGER NOT NULL DEFAULT 100,
  "amenities"    TEXT,
  "is_active"    BOOLEAN NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gyms_owner_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "gym_memberships" (
  "id"         TEXT PRIMARY KEY,
  "gym_id"     TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "joined_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "gym_memberships_gym_fk"  FOREIGN KEY ("gym_id")  REFERENCES "gyms"("id")  ON DELETE CASCADE,
  CONSTRAINT "gym_memberships_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "gym_memberships_unique" UNIQUE ("gym_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "gym_check_ins" (
  "id"             TEXT PRIMARY KEY,
  "gym_id"         TEXT NOT NULL,
  "user_id"        TEXT NOT NULL,
  "checked_in_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gym_check_ins_gym_fk"  FOREIGN KEY ("gym_id")  REFERENCES "gyms"("id")  ON DELETE CASCADE,
  CONSTRAINT "gym_check_ins_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "gym_check_ins_gym_idx"  ON "gym_check_ins"("gym_id", "checked_in_at");
CREATE INDEX IF NOT EXISTS "gym_check_ins_user_idx" ON "gym_check_ins"("user_id", "checked_in_at");

-- =============================================================================
-- Workouts
-- =============================================================================
CREATE TABLE IF NOT EXISTS "workouts" (
  "id"             TEXT PRIMARY KEY,
  "created_by_id"  TEXT,
  "title"          TEXT NOT NULL,
  "category"       TEXT NOT NULL,
  "difficulty"     TEXT NOT NULL,
  "duration_min"   INTEGER NOT NULL,
  "calories"       INTEGER NOT NULL,
  "image_url"      TEXT,
  "description"    TEXT,
  "is_public"      BOOLEAN NOT NULL DEFAULT true,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workouts_creator_fk" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "workouts_category_idx" ON "workouts"("category");

CREATE TABLE IF NOT EXISTS "workout_logs" (
  "id"           TEXT PRIMARY KEY,
  "user_id"      TEXT NOT NULL,
  "workout_id"   TEXT NOT NULL,
  "logged_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "duration_min" INTEGER,
  "notes"        TEXT,
  CONSTRAINT "workout_logs_user_fk"    FOREIGN KEY ("user_id")    REFERENCES "users"("id")    ON DELETE CASCADE,
  CONSTRAINT "workout_logs_workout_fk" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "workout_logs_user_idx" ON "workout_logs"("user_id", "logged_at");

-- =============================================================================
-- Nutrition
-- =============================================================================
CREATE TABLE IF NOT EXISTS "food_items" (
  "id"        TEXT PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "category"  TEXT NOT NULL,
  "calories"  INTEGER NOT NULL,
  "protein"   DOUBLE PRECISION NOT NULL,
  "carbs"     DOUBLE PRECISION NOT NULL,
  "fat"       DOUBLE PRECISION NOT NULL,
  "image_url" TEXT,
  "is_public" BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS "food_items_name_idx" ON "food_items"("name");

CREATE TABLE IF NOT EXISTS "food_logs" (
  "id"           TEXT PRIMARY KEY,
  "user_id"      TEXT NOT NULL,
  "food_item_id" TEXT NOT NULL,
  "logged_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grams"        DOUBLE PRECISION NOT NULL,
  CONSTRAINT "food_logs_user_fk" FOREIGN KEY ("user_id")      REFERENCES "users"("id")      ON DELETE CASCADE,
  CONSTRAINT "food_logs_item_fk" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "food_logs_user_idx" ON "food_logs"("user_id", "logged_at");

-- =============================================================================
-- Marketplace
-- =============================================================================
CREATE TABLE IF NOT EXISTS "products" (
  "id"          TEXT PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "brand"       TEXT NOT NULL,
  "price"       DOUBLE PRECISION NOT NULL,
  "image_url"   TEXT,
  "description" TEXT,
  "stock"       INTEGER NOT NULL DEFAULT 0,
  "is_active"   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id"         TEXT PRIMARY KEY,
  "user_id"    TEXT NOT NULL,
  "status"     "OrderStatus" NOT NULL DEFAULT 'pending',
  "total"      DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "orders_user_idx" ON "orders"("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "order_items" (
  "id"         TEXT PRIMARY KEY,
  "order_id"   TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "quantity"   INTEGER NOT NULL DEFAULT 1,
  "unit_price" DOUBLE PRECISION NOT NULL,
  CONSTRAINT "order_items_order_fk"   FOREIGN KEY ("order_id")   REFERENCES "orders"("id")   ON DELETE CASCADE,
  CONSTRAINT "order_items_product_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT
);

-- =============================================================================
-- Trainer bookings
-- =============================================================================
CREATE TABLE IF NOT EXISTS "trainer_bookings" (
  "id"           TEXT PRIMARY KEY,
  "athlete_id"   TEXT NOT NULL,
  "trainer_id"   TEXT NOT NULL,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "status"       "BookingStatus" NOT NULL DEFAULT 'pending',
  "notes"        TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trainer_bookings_athlete_fk" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "trainer_bookings_trainer_fk" FOREIGN KEY ("trainer_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "trainer_bookings_athlete_idx" ON "trainer_bookings"("athlete_id", "scheduled_at");
CREATE INDEX IF NOT EXISTS "trainer_bookings_trainer_idx" ON "trainer_bookings"("trainer_id", "scheduled_at");

-- =============================================================================
-- Community
-- =============================================================================
CREATE TABLE IF NOT EXISTS "community_posts" (
  "id"          TEXT PRIMARY KEY,
  "author_id"   TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "image_url"   TEXT,
  "likes_count" INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "community_posts_author_fk" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "community_posts_created_idx" ON "community_posts"("created_at" DESC);

CREATE TABLE IF NOT EXISTS "community_comments" (
  "id"         TEXT PRIMARY KEY,
  "post_id"    TEXT NOT NULL,
  "author_id"  TEXT NOT NULL,
  "content"    TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_comments_post_fk"   FOREIGN KEY ("post_id")   REFERENCES "community_posts"("id") ON DELETE CASCADE,
  CONSTRAINT "community_comments_author_fk" FOREIGN KEY ("author_id") REFERENCES "users"("id")           ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "community_post_likes" (
  "id"         TEXT PRIMARY KEY,
  "post_id"    TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_post_likes_post_fk" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE,
  CONSTRAINT "community_post_likes_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id")           ON DELETE CASCADE,
  CONSTRAINT "community_post_likes_unique"  UNIQUE ("post_id", "user_id")
);

-- =============================================================================
-- Notifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS "notifications" (
  "id"         TEXT PRIMARY KEY,
  "user_id"    TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "message"    TEXT NOT NULL,
  "link"       TEXT,
  "read"       BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications"("user_id", "created_at" DESC);
