-- Cached AI/heuristic sentiment summary per gym
CREATE TABLE "gym_review_analyses" (
    "gym_id" TEXT NOT NULL,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "positive_pct" INTEGER NOT NULL DEFAULT 0,
    "neutral_pct" INTEGER NOT NULL DEFAULT 0,
    "negative_pct" INTEGER NOT NULL DEFAULT 0,
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'stars',
    "reviews_fingerprint" TEXT,
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_review_analyses_pkey" PRIMARY KEY ("gym_id")
);

ALTER TABLE "gym_review_analyses" ADD CONSTRAINT "gym_review_analyses_gym_id_fkey" FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
