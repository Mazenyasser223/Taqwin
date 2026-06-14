-- User-owned nutrition and workout libraries.

ALTER TABLE "food_items" ADD COLUMN "user_id" TEXT;

CREATE TABLE "user_meals" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "default_slot_id" VARCHAR(64),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_meals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_meal_items" (
  "id" TEXT NOT NULL,
  "meal_id" TEXT NOT NULL,
  "food_item_id" TEXT,
  "name" TEXT NOT NULL,
  "grams" DOUBLE PRECISION NOT NULL,
  "calories" INTEGER,
  "protein" DOUBLE PRECISION,
  "carbs" DOUBLE PRECISION,
  "fat" DOUBLE PRECISION,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "user_meal_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saved_workout_routines" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "source_day_id" TEXT,
  "name" TEXT NOT NULL,
  "focus" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "saved_workout_routines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saved_workout_routine_exercises" (
  "id" TEXT NOT NULL,
  "routine_id" TEXT NOT NULL,
  "exercise_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "sets" INTEGER,
  "reps" TEXT,
  "rest_sec" INTEGER,
  "notes" TEXT,
  CONSTRAINT "saved_workout_routine_exercises_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "food_items_user_id_name_idx" ON "food_items"("user_id", "name");
CREATE INDEX "food_items_is_public_name_idx" ON "food_items"("is_public", "name");
CREATE INDEX "user_meals_user_id_name_idx" ON "user_meals"("user_id", "name");
CREATE INDEX "user_meal_items_meal_id_sort_order_idx" ON "user_meal_items"("meal_id", "sort_order");
CREATE INDEX "user_meal_items_food_item_id_idx" ON "user_meal_items"("food_item_id");
CREATE INDEX "saved_workout_routines_user_id_name_idx" ON "saved_workout_routines"("user_id", "name");
CREATE INDEX "saved_workout_routines_source_day_id_idx" ON "saved_workout_routines"("source_day_id");
CREATE INDEX "saved_workout_routine_exercises_routine_id_sort_order_idx" ON "saved_workout_routine_exercises"("routine_id", "sort_order");
CREATE INDEX "saved_workout_routine_exercises_exercise_id_idx" ON "saved_workout_routine_exercises"("exercise_id");

ALTER TABLE "food_items" ADD CONSTRAINT "food_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_meals" ADD CONSTRAINT "user_meals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_meal_items" ADD CONSTRAINT "user_meal_items_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "user_meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_meal_items" ADD CONSTRAINT "user_meal_items_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saved_workout_routines" ADD CONSTRAINT "saved_workout_routines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_workout_routines" ADD CONSTRAINT "saved_workout_routines_source_day_id_fkey" FOREIGN KEY ("source_day_id") REFERENCES "workout_plan_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saved_workout_routine_exercises" ADD CONSTRAINT "saved_workout_routine_exercises_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "saved_workout_routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_workout_routine_exercises" ADD CONSTRAINT "saved_workout_routine_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
