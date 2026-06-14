-- Block A0 — AI Coach foundation (plans, progress, RAG, audit)
-- pgvector: enable in Supabase Dashboard → Database → Extensions → vector (usually pre-enabled)

-- Enums
CREATE TYPE "PlanSource" AS ENUM ('onboarding', 'weekly_cron', 'adaptation', 'manual');
CREATE TYPE "PlanStatus" AS ENUM ('draft', 'active', 'superseded', 'archived');
CREATE TYPE "LifeMode" AS ENUM ('normal', 'travel', 'sick', 'fasting', 'injury_flare');
CREATE TYPE "DailyPlanStatus" AS ENUM ('pending', 'active', 'skipped', 'completed', 'adapted');
CREATE TYPE "AdaptationDecision" AS ENUM ('keep', 'micro', 'meso', 'macro');
CREATE TYPE "KnowledgeLevel" AS ENUM ('L1_INTERNAL', 'L2_EXERCISE', 'L3_NUTRITION', 'L4_SCIENTIFIC', 'L5_BOOKS');

-- AI audit & memory
CREATE TABLE "ai_memories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_tool_executions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "thread_id" TEXT,
    "tool_name" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_tool_executions_pkey" PRIMARY KEY ("id")
);

-- Workout plans
CREATE TABLE "workout_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'active',
    "source" "PlanSource" NOT NULL,
    "ai_notes" TEXT,
    "explainability_text" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workout_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workout_plan_days" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "day_index" INTEGER NOT NULL,
    "focus" TEXT,
    "is_rest_day" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "workout_plan_days_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workout_plan_exercises" (
    "id" TEXT NOT NULL,
    "day_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "sets" INTEGER,
    "reps" TEXT,
    "rest_sec" INTEGER,
    "notes" TEXT,
    CONSTRAINT "workout_plan_exercises_pkey" PRIMARY KEY ("id")
);

-- Diet plans
CREATE TABLE "diet_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'active',
    "source" "PlanSource" NOT NULL,
    "target_calories" INTEGER,
    "target_protein_g" INTEGER,
    "target_carbs_g" INTEGER,
    "target_fat_g" INTEGER,
    "ai_notes" TEXT,
    "explainability_text" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "diet_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "diet_plan_days" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "day_index" INTEGER NOT NULL,
    CONSTRAINT "diet_plan_days_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "diet_plan_meals" (
    "id" TEXT NOT NULL,
    "day_id" TEXT NOT NULL,
    "meal_type" TEXT NOT NULL,
    "time_window" TEXT,
    CONSTRAINT "diet_plan_meals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "diet_plan_meal_items" (
    "id" TEXT NOT NULL,
    "meal_id" TEXT NOT NULL,
    "food_item_id" TEXT,
    "label" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    CONSTRAINT "diet_plan_meal_items_pkey" PRIMARY KEY ("id")
);

-- Daily dashboard slice
CREATE TABLE "daily_athlete_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "workout_plan_day_id" TEXT,
    "diet_plan_day_id" TEXT,
    "status" "DailyPlanStatus" NOT NULL DEFAULT 'active',
    "life_mode" "LifeMode" NOT NULL DEFAULT 'normal',
    "ai_notes" TEXT,
    "explainability_text" TEXT,
    "adapted_from_progress" BOOLEAN NOT NULL DEFAULT false,
    "readiness_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "daily_athlete_plans_pkey" PRIMARY KEY ("id")
);

-- Progress & feedback
CREATE TABLE "body_metrics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "weight_kg" DOUBLE PRECISION,
    "body_fat_pct" DOUBLE PRECISION,
    "measurements" JSONB,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "body_metrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "readiness_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sleep_quality" INTEGER,
    "soreness" INTEGER,
    "rpe" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "readiness_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "progress_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "adherence_pct" DOUBLE PRECISION,
    "workout_adherence" DOUBLE PRECISION,
    "nutrition_adherence" DOUBLE PRECISION,
    "weight_delta_kg" DOUBLE PRECISION,
    "plateau_flag" BOOLEAN NOT NULL DEFAULT false,
    "ai_summary" TEXT,
    "decision" "AdaptationDecision" NOT NULL DEFAULT 'keep',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "progress_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plan_feedbacks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "week_start" DATE NOT NULL,
    "rating" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plan_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plan_change_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "reason" TEXT,
    "before_summary" JSONB,
    "after_summary" JSONB,
    "triggered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "plan_change_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "progress_photos" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "caption" TEXT,
    "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "progress_photos_pkey" PRIMARY KEY ("id")
);

-- RAG (embedding column added below when pgvector is enabled)
CREATE TABLE "knowledge_documents" (
    "id" TEXT NOT NULL,
    "level" "KnowledgeLevel" NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "storage_path" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "ai_memories_user_id_key_key" ON "ai_memories"("user_id", "key");
CREATE INDEX "ai_memories_user_id_idx" ON "ai_memories"("user_id");
CREATE INDEX "ai_tool_executions_user_id_created_at_idx" ON "ai_tool_executions"("user_id", "created_at");
CREATE INDEX "ai_tool_executions_tool_name_idx" ON "ai_tool_executions"("tool_name");
CREATE INDEX "workout_plans_user_id_week_start_idx" ON "workout_plans"("user_id", "week_start");
CREATE UNIQUE INDEX "workout_plan_days_plan_id_day_index_key" ON "workout_plan_days"("plan_id", "day_index");
CREATE INDEX "workout_plan_exercises_day_id_sort_order_idx" ON "workout_plan_exercises"("day_id", "sort_order");
CREATE INDEX "diet_plans_user_id_week_start_idx" ON "diet_plans"("user_id", "week_start");
CREATE UNIQUE INDEX "diet_plan_days_plan_id_day_index_key" ON "diet_plan_days"("plan_id", "day_index");
CREATE INDEX "diet_plan_meals_day_id_idx" ON "diet_plan_meals"("day_id");
CREATE INDEX "diet_plan_meal_items_meal_id_idx" ON "diet_plan_meal_items"("meal_id");
CREATE UNIQUE INDEX "daily_athlete_plans_user_id_date_key" ON "daily_athlete_plans"("user_id", "date");
CREATE INDEX "daily_athlete_plans_user_id_date_idx" ON "daily_athlete_plans"("user_id", "date");
CREATE INDEX "body_metrics_user_id_recorded_at_idx" ON "body_metrics"("user_id", "recorded_at");
CREATE UNIQUE INDEX "readiness_logs_user_id_date_key" ON "readiness_logs"("user_id", "date");
CREATE UNIQUE INDEX "progress_snapshots_user_id_week_start_key" ON "progress_snapshots"("user_id", "week_start");
CREATE INDEX "plan_feedbacks_user_id_week_start_idx" ON "plan_feedbacks"("user_id", "week_start");
CREATE INDEX "plan_change_logs_user_id_created_at_idx" ON "plan_change_logs"("user_id", "created_at");
CREATE INDEX "progress_photos_user_id_idx" ON "progress_photos"("user_id");
CREATE INDEX "knowledge_documents_level_idx" ON "knowledge_documents"("level");
CREATE INDEX "knowledge_chunks_document_id_idx" ON "knowledge_chunks"("document_id");

-- Foreign keys
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_tool_executions" ADD CONSTRAINT "ai_tool_executions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_plans" ADD CONSTRAINT "workout_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_plan_days" ADD CONSTRAINT "workout_plan_days_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "workout_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_plan_exercises" ADD CONSTRAINT "workout_plan_exercises_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "workout_plan_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workout_plan_exercises" ADD CONSTRAINT "workout_plan_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "diet_plans" ADD CONSTRAINT "diet_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diet_plan_days" ADD CONSTRAINT "diet_plan_days_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "diet_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diet_plan_meals" ADD CONSTRAINT "diet_plan_meals_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "diet_plan_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diet_plan_meal_items" ADD CONSTRAINT "diet_plan_meal_items_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "diet_plan_meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diet_plan_meal_items" ADD CONSTRAINT "diet_plan_meal_items_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "daily_athlete_plans" ADD CONSTRAINT "daily_athlete_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_athlete_plans" ADD CONSTRAINT "daily_athlete_plans_workout_plan_day_id_fkey" FOREIGN KEY ("workout_plan_day_id") REFERENCES "workout_plan_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "daily_athlete_plans" ADD CONSTRAINT "daily_athlete_plans_diet_plan_day_id_fkey" FOREIGN KEY ("diet_plan_day_id") REFERENCES "diet_plan_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "body_metrics" ADD CONSTRAINT "body_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "readiness_logs" ADD CONSTRAINT "readiness_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "progress_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_feedbacks" ADD CONSTRAINT "plan_feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_change_logs" ADD CONSTRAINT "plan_change_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progress_photos" ADD CONSTRAINT "progress_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- pgvector embedding column (requires vector extension — enable in Supabase if this fails)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    ALTER TABLE "knowledge_chunks" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);
  END IF;
END $$;
