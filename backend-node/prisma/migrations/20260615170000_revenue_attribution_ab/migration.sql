-- Revenue attribution sources + A/B experiment tables

CREATE INDEX IF NOT EXISTS "orders_commerce_source_idx" ON "orders"("commerce_source");

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "commerce_ab_variant" TEXT,
  ADD COLUMN IF NOT EXISTS "commerce_experiment_id" UUID;

CREATE TABLE IF NOT EXISTS "commerce_experiments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "winner_variant_key" TEXT,
  "min_samples" INTEGER NOT NULL DEFAULT 50,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commerce_experiments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "commerce_experiments_slug_key" ON "commerce_experiments"("slug");

CREATE TABLE IF NOT EXISTS "commerce_experiment_variants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "experiment_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slot_config" JSONB NOT NULL DEFAULT '{}',
  "weight" INTEGER NOT NULL DEFAULT 50,
  "is_winner" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commerce_experiment_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "commerce_experiment_variants_experiment_id_key_key"
  ON "commerce_experiment_variants"("experiment_id", "key");

ALTER TABLE "commerce_experiment_variants"
  ADD CONSTRAINT "commerce_experiment_variants_experiment_id_fkey"
  FOREIGN KEY ("experiment_id") REFERENCES "commerce_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default bundle A/B experiment
INSERT INTO "commerce_experiments" ("id", "slug", "name", "status", "min_samples")
VALUES ('11111111-1111-4111-8111-111111111101', 'bundle-composition', 'Bundle composition', 'active', 50)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "commerce_experiment_variants" ("experiment_id", "key", "name", "slot_config", "weight")
SELECT e.id, v.key, v.name, v.slot_config::jsonb, v.weight
FROM "commerce_experiments" e
CROSS JOIN (VALUES
  ('A', 'Creatine + Whey', '{"includeShaker": false}', 50),
  ('B', 'Creatine + Whey + Shaker', '{"includeShaker": true}', 50)
) AS v(key, name, slot_config, weight)
WHERE e.slug = 'bundle-composition'
ON CONFLICT ("experiment_id", "key") DO NOTHING;
