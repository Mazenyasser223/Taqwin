/**
 * AI-generated plan persisted to MongoDB.
 *
 * One document = the user's diet + workout plan version. Only one document
 * per user has `isActive: true` at a time; regenerating creates a new doc
 * and flips the previous one off (see `lib/plans/save.js`).
 *
 * Foreign keys to Postgres rows are stored as strings:
 *   - userId        -> Profile.userId / User.id (UUID string)
 *   - foodItemId    -> FoodItem.id   (UUID string)
 *   - webtebId      -> WebtebFood.webtebId (int) — optional
 *   - exerciseId    -> Exercise.id   (UUID string)
 *
 * The shape matches the Zod schema in `lib/plans/schema.js` (Phase 3) and the
 * AI prompt contract in shared/plan-prompt-contract.json (FastAPI plan_prompts.py).
 */
const { mongoose } = require('../client');
const { Schema } = mongoose;

const MealSchema = new Schema(
  {
    slot: { type: String, required: true }, // breakfast | lunch | dinner | snack
    foodItemId: { type: String, default: null },
    webtebId: { type: Number, default: null },
    name: { type: String, required: true },
    grams: { type: Number, required: true, min: 0 },
    calories: { type: Number, default: 0 },
    protein: { type: Number, default: 0 },
    carbs: { type: Number, default: 0 },
    fat: { type: Number, default: 0 },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const DietDaySchema = new Schema(
  {
    dayIndex: { type: Number, required: true, min: 1, max: 7 },
    label: { type: String, default: '' }, // e.g. "Monday" / "اليوم 1"
    meals: { type: [MealSchema], default: [] },
  },
  { _id: false }
);

const ExerciseEntrySchema = new Schema(
  {
    exerciseId: { type: String, default: null },
    name: { type: String, required: true },
    sets: { type: Number, required: true, min: 1, max: 10 },
    reps: { type: Number, required: true, min: 1, max: 50 },
    restSec: { type: Number, default: 90 },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const WorkoutDaySchema = new Schema(
  {
    dayIndex: { type: Number, required: true, min: 1, max: 7 },
    type: { type: String, default: 'full' }, // push | pull | legs | upper | lower | full | cardio | rest
    label: { type: String, default: '' },
    isRest: { type: Boolean, default: false },
    exercises: { type: [ExerciseEntrySchema], default: [] },
  },
  { _id: false }
);

const WorkoutWeekSchema = new Schema(
  {
    weekIndex: { type: Number, required: true, min: 1, max: 12 },
    days: { type: [WorkoutDaySchema], default: [] },
  },
  { _id: false }
);

const DailyTargetsSchema = new Schema(
  {
    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fat: { type: Number, required: true },
    waterMl: { type: Number, required: true },
  },
  { _id: false }
);

const PlanSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
    source: {
      type: String,
      enum: ['ai', 'fallback', 'manual'],
      default: 'ai',
    },
    locale: { type: String, default: 'ar' },
    regenerationReason: { type: String, default: '' },
    coachNotes: { type: String, default: '' },

    dailyTargets: { type: DailyTargetsSchema, required: true },
    dietDays: { type: [DietDaySchema], default: [] },
    workoutWeeks: { type: [WorkoutWeekSchema], default: [] },

    // Snapshot of the inputs that produced this plan; useful for debugging,
    // re-running with the same prompt, and audit. Free-form JSON.
    inputSnapshot: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: 'plans',
  }
);

PlanSchema.index({ userId: 1, isActive: 1 });
PlanSchema.index({ userId: 1, createdAt: -1 });
/** Legacy inactive plans auto-expire after 90 days (Postgres is official store). */
PlanSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 90 * 24 * 60 * 60,
    partialFilterExpression: { isActive: false },
    name: 'legacy_inactive_plans_ttl',
  }
);

const PlanModel = mongoose.models.Plan || mongoose.model('Plan', PlanSchema);

module.exports = PlanModel;
module.exports.PlanSchema = PlanSchema;
