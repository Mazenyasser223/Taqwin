-- CreateIndex
CREATE INDEX "workout_logs_user_id_logged_at_idx" ON "workout_logs"("user_id", "logged_at");

-- CreateIndex
CREATE INDEX "food_logs_user_id_logged_at_idx" ON "food_logs"("user_id", "logged_at");
