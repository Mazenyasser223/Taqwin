/**
 * Exercise fitness goal tags for library filters.
 * Keep in sync with frontend/features/workouts/exerciseFitnessGoals.ts
 */

const EXERCISE_FITNESS_GOALS = ['lose-weight', 'gain-strength', 'gain-muscle'];

const LOSE_WEIGHT_CATEGORIES = new Set([
  'cardio',
  'yoga',
  'pilates',
  'stretches',
  'recovery',
  'trx',
]);

const RESISTANCE_CATEGORIES = new Set([
  'barbell',
  'dumbbells',
  'kettlebells',
  'plate',
  'machine',
  'cables',
  'smith-machine',
  'band',
  'bodyweight',
  'medicine-ball',
  'medicineball',
  'bosu-ball',
  'vitruvian',
  'general',
]);

const HEAVY_STRENGTH_CATEGORIES = new Set([
  'barbell',
  'dumbbells',
  'kettlebells',
  'plate',
  'machine',
  'smith-machine',
]);

const COMPOUND_NAME_HINT =
  /squat|deadlift|bench press|overhead press|military press|row|pull.?up|chin.?up|lunge|hip thrust|clean|snatch|thruster|push press|good morning|leg press|rack pull|farmer|carry/i;

const CONDITIONING_NAME_HINT =
  /burpee|jumping jack|mountain climber|high knee|skater|sprint|box jump|jump rope|battle rope|cardio|treadmill|cycle|bike|run|jog|walk/i;

function isCompoundExercise(row) {
  const mechanic = String(row.mechanic || '').toLowerCase();
  if (mechanic === 'compound') return true;
  if (mechanic === 'isolation') return false;
  const cat = String(row.category || '').toLowerCase();
  if (['barbell', 'smith-machine', 'kettlebells'].includes(cat)) return true;
  return COMPOUND_NAME_HINT.test(String(row.name || ''));
}

function classifyExerciseFitnessGoals(row) {
  const goals = new Set();
  const cat = String(row.category || '').toLowerCase();
  const name = String(row.name || '');

  if (LOSE_WEIGHT_CATEGORIES.has(cat) || CONDITIONING_NAME_HINT.test(name)) {
    goals.add('lose-weight');
  }

  if (RESISTANCE_CATEGORIES.has(cat) && !LOSE_WEIGHT_CATEGORIES.has(cat)) {
    goals.add('gain-muscle');
  }

  if (HEAVY_STRENGTH_CATEGORIES.has(cat) && isCompoundExercise(row)) {
    goals.add('gain-strength');
  } else if (cat === 'barbell' || cat === 'smith-machine') {
    goals.add('gain-strength');
  } else if (isCompoundExercise(row) && RESISTANCE_CATEGORIES.has(cat)) {
    goals.add('gain-strength');
  }

  if (cat === 'bodyweight' && !goals.has('lose-weight') && !goals.has('gain-muscle')) {
    goals.add('gain-muscle');
  }

  if (goals.size === 0 && RESISTANCE_CATEGORIES.has(cat)) {
    goals.add('gain-muscle');
  }

  return [...goals].sort();
}

function parseGoalsParam(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const allowed = new Set(EXERCISE_FITNESS_GOALS);
  return [...new Set(raw.split(',').map((s) => s.trim()).filter((g) => allowed.has(g)))];
}

function goalsPrismaFilter(goals) {
  if (!goals?.length) return null;
  return { fitnessGoals: { hasSome: goals } };
}

module.exports = {
  EXERCISE_FITNESS_GOALS,
  classifyExerciseFitnessGoals,
  parseGoalsParam,
  goalsPrismaFilter,
};
