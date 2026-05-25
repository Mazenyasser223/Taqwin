-- CreateTable
CREATE TABLE IF NOT EXISTS "onboarding_question_catalog" (
    "id" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "title_ar" TEXT NOT NULL,
    "reason_ar" TEXT,
    "step_type" TEXT,
    "options" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "onboarding_question_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_question_catalog_flow_step_id_key" ON "onboarding_question_catalog"("flow", "step_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "onboarding_question_catalog_flow_sort_order_idx" ON "onboarding_question_catalog"("flow", "sort_order");
