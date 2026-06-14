-- Polls on community posts
CREATE TABLE IF NOT EXISTS "community_polls" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ends_at" TIMESTAMP(3),
  CONSTRAINT "community_polls_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "community_polls_post_id_key" ON "community_polls"("post_id");

CREATE TABLE IF NOT EXISTS "community_poll_options" (
  "id" TEXT NOT NULL,
  "poll_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "votes_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "community_poll_options_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "community_poll_options_poll_id_sort_order_idx"
  ON "community_poll_options"("poll_id", "sort_order");

CREATE TABLE IF NOT EXISTS "community_poll_votes" (
  "id" TEXT NOT NULL,
  "poll_id" TEXT NOT NULL,
  "option_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_poll_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "community_poll_votes_poll_id_user_id_key"
  ON "community_poll_votes"("poll_id", "user_id");

CREATE INDEX IF NOT EXISTS "community_poll_votes_option_id_idx" ON "community_poll_votes"("option_id");

ALTER TABLE "community_polls"
  ADD CONSTRAINT "community_polls_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_poll_options"
  ADD CONSTRAINT "community_poll_options_poll_id_fkey"
  FOREIGN KEY ("poll_id") REFERENCES "community_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_poll_votes"
  ADD CONSTRAINT "community_poll_votes_poll_id_fkey"
  FOREIGN KEY ("poll_id") REFERENCES "community_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_poll_votes"
  ADD CONSTRAINT "community_poll_votes_option_id_fkey"
  FOREIGN KEY ("option_id") REFERENCES "community_poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "community_poll_votes"
  ADD CONSTRAINT "community_poll_votes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
