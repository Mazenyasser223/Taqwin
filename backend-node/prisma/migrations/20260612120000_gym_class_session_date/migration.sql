-- One-time session date per gym class (not weekly recurring)
ALTER TABLE "gym_classes" ADD COLUMN IF NOT EXISTS "session_date" DATE;

UPDATE "gym_classes"
SET "session_date" = (
  CURRENT_DATE + (
    ("day_of_week" - EXTRACT(DOW FROM CURRENT_DATE)::integer + 7) % 7
  )::integer
)::date
WHERE "session_date" IS NULL;
