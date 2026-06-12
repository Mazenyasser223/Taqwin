/**
 * Zod schema for AI-generated plans.
 *
 * Mirrors the Mongoose `Plan` model in `db/mongo/models/plan.js` and the JSON
 * contract the LLM is asked to produce (see shared/plan-prompt-contract.json).
 *
 * Use `PlanSchema.safeParse(json)` to assert shape before passing to the
 * business-rule validator (`lib/plans/validator.js`).
 */
const { z } = require('zod');

const MealSchema = z.object({
  slot: z.string().min(1),
  foodItemId: z.string().nullable().optional(),
  webtebId: z.number().int().nullable().optional(),
  name: z.string().min(1),
  grams: z.number().positive(),
  calories: z.number().nonnegative().optional().default(0),
  protein: z.number().nonnegative().optional().default(0),
  carbs: z.number().nonnegative().optional().default(0),
  fat: z.number().nonnegative().optional().default(0),
  notes: z.string().optional().default(''),
});

const DietDaySchema = z.object({
  dayIndex: z.number().int().min(1).max(7),
  label: z.string().optional().default(''),
  meals: z.array(MealSchema).min(1).max(8),
});

const ExerciseEntrySchema = z.object({
  exerciseId: z.string().nullable().optional(),
  name: z.string().min(1),
  sets: z.number().int().min(1).max(10),
  reps: z.number().int().min(1).max(50),
  restSec: z.number().int().nonnegative().optional().default(90),
  notes: z.string().optional().default(''),
});

const WorkoutDaySchema = z.object({
  dayIndex: z.number().int().min(1).max(7),
  type: z.string().optional().default('full'),
  label: z.string().optional().default(''),
  isRest: z.boolean().optional().default(false),
  exercises: z.array(ExerciseEntrySchema).max(10).optional().default([]),
});

const WorkoutWeekSchema = z.object({
  weekIndex: z.number().int().min(1).max(12),
  days: z.array(WorkoutDaySchema).min(1).max(7),
});

const DailyTargetsSchema = z.object({
  calories: z.number().positive(),
  protein: z.number().positive(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  waterMl: z.number().positive(),
});

const PlanSchema = z.object({
  dailyTargets: DailyTargetsSchema,
  dietDays: z.array(DietDaySchema).min(1).max(7),
  workoutWeeks: z.array(WorkoutWeekSchema).min(1).max(12),
  coachNotes: z.string().optional().default(''),
  regenerationReason: z.string().optional().default(''),
});

module.exports = {
  PlanSchema,
  MealSchema,
  DietDaySchema,
  ExerciseEntrySchema,
  WorkoutDaySchema,
  WorkoutWeekSchema,
  DailyTargetsSchema,
};
