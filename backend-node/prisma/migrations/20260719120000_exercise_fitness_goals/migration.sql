ALTER TABLE "exercises" ADD COLUMN "fitness_goals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "exercises_fitness_goals_idx" ON "exercises" USING GIN ("fitness_goals");
