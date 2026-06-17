-- Gym member reviews (ratings + text)
CREATE TABLE "gym_reviews" (
    "id" TEXT NOT NULL,
    "gym_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gym_reviews_gym_id_user_id_key" ON "gym_reviews"("gym_id", "user_id");
CREATE INDEX "gym_reviews_gym_id_created_at_idx" ON "gym_reviews"("gym_id", "created_at");

ALTER TABLE "gym_reviews" ADD CONSTRAINT "gym_reviews_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gym_reviews" ADD CONSTRAINT "gym_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
