/**
 * Deterministic safe fallback plan.
 *
 * Used when:
 *   - MONGO_URI is set but the LLM is unavailable
 *   - The LLM output fails validation twice in a row
 *   - Retrieval returns an empty food/exercise list
 *
 * Produces a 7-day diet (4 meals each) and a 4-week workout aligned with
 * the user's training-days-per-week. All meal names are generic and don't
 * include allergy keywords, and all exercises are pre-filtered through
 * `constraints.isExerciseBlocked` against the user's injuries.
 */
const { isExerciseBlocked, buildExclusionMatchers } = require('./constraints');

const SAFE_BREAKFASTS = [
  { name: 'Greek yogurt with oats', protein: 25, carbs: 50, fat: 6, grams: 350 },
  { name: 'Oats with banana and honey', protein: 12, carbs: 65, fat: 5, grams: 300 },
  { name: 'Protein smoothie with banana', protein: 28, carbs: 45, fat: 4, grams: 400 },
  { name: 'Scrambled eggs with toast', protein: 24, carbs: 35, fat: 14, grams: 250 },
  { name: 'Cottage cheese with fruit', protein: 22, carbs: 35, fat: 5, grams: 300 },
  { name: 'Whole-grain pancakes with yogurt', protein: 20, carbs: 55, fat: 8, grams: 320 },
  { name: 'Foul medames with bread', protein: 18, carbs: 60, fat: 8, grams: 350 },
];

const SAFE_LUNCHES = [
  { name: 'Grilled chicken with rice and salad', protein: 40, carbs: 70, fat: 10, grams: 450 },
  { name: 'Beef burger patty with vegetables', protein: 38, carbs: 35, fat: 18, grams: 400 },
  { name: 'Lentil soup with bread', protein: 22, carbs: 65, fat: 6, grams: 450 },
  { name: 'Tuna with rice and vegetables', protein: 35, carbs: 65, fat: 8, grams: 420 },
  { name: 'Chicken shawarma bowl', protein: 38, carbs: 60, fat: 12, grams: 450 },
  { name: 'Grilled turkey with potatoes', protein: 40, carbs: 60, fat: 8, grams: 450 },
  { name: 'Chickpea stew with rice', protein: 22, carbs: 75, fat: 6, grams: 450 },
];

const SAFE_DINNERS = [
  { name: 'Grilled chicken with vegetables', protein: 38, carbs: 30, fat: 8, grams: 400 },
  { name: 'Beef stir-fry with rice', protein: 36, carbs: 60, fat: 12, grams: 400 },
  { name: 'Baked fish with sweet potato', protein: 35, carbs: 45, fat: 8, grams: 400 },
  { name: 'Chicken kabsa', protein: 36, carbs: 65, fat: 12, grams: 450 },
  { name: 'Turkey meatballs with pasta', protein: 38, carbs: 55, fat: 12, grams: 420 },
  { name: 'Grilled chicken with quinoa', protein: 38, carbs: 50, fat: 8, grams: 420 },
  { name: 'Beef koshari', protein: 22, carbs: 80, fat: 10, grams: 450 },
];

const SAFE_SNACKS = [
  { name: 'Apple with peanut butter', protein: 6, carbs: 25, fat: 8, grams: 200 },
  { name: 'Mixed nuts handful', protein: 6, carbs: 8, fat: 18, grams: 30 },
  { name: 'Boiled eggs', protein: 12, carbs: 1, fat: 10, grams: 100 },
  { name: 'Protein bar', protein: 20, carbs: 22, fat: 6, grams: 60 },
  { name: 'Greek yogurt', protein: 18, carbs: 8, fat: 0, grams: 200 },
  { name: 'Banana with almond butter', protein: 5, carbs: 30, fat: 9, grams: 150 },
  { name: 'Hummus with carrots', protein: 6, carbs: 20, fat: 8, grams: 180 },
];

const SAFE_EXERCISE_POOL = [
  { name: 'Goblet Squat', type: 'legs', sets: 3, reps: 12, restSec: 90 },
  { name: 'Dumbbell Romanian Deadlift', type: 'legs', sets: 3, reps: 12, restSec: 90 },
  { name: 'Glute Bridge', type: 'legs', sets: 3, reps: 15, restSec: 60 },
  { name: 'Step-Up', type: 'legs', sets: 3, reps: 10, restSec: 60 },
  { name: 'Dumbbell Chest Press', type: 'push', sets: 3, reps: 12, restSec: 90 },
  { name: 'Incline Dumbbell Press', type: 'push', sets: 3, reps: 12, restSec: 90 },
  { name: 'Cable Chest Fly', type: 'push', sets: 3, reps: 12, restSec: 75 },
  { name: 'Seated Dumbbell Shoulder Press', type: 'push', sets: 3, reps: 12, restSec: 90 },
  { name: 'Lateral Raise', type: 'push', sets: 3, reps: 15, restSec: 60 },
  { name: 'Dumbbell Row', type: 'pull', sets: 3, reps: 12, restSec: 90 },
  { name: 'Lat Pulldown', type: 'pull', sets: 3, reps: 12, restSec: 90 },
  { name: 'Seated Cable Row', type: 'pull', sets: 3, reps: 12, restSec: 90 },
  { name: 'Face Pull', type: 'pull', sets: 3, reps: 15, restSec: 60 },
  { name: 'Dumbbell Biceps Curl', type: 'arms', sets: 3, reps: 12, restSec: 60 },
  { name: 'Triceps Pushdown', type: 'arms', sets: 3, reps: 12, restSec: 60 },
  { name: 'Plank', type: 'core', sets: 3, reps: 1, restSec: 60, notes: 'Hold 45s' },
  { name: 'Dead Bug', type: 'core', sets: 3, reps: 10, restSec: 45 },
  { name: 'Brisk Walking', type: 'cardio', sets: 1, reps: 1, restSec: 0, notes: '25 min' },
  { name: 'Stationary Bike', type: 'cardio', sets: 1, reps: 1, restSec: 0, notes: '20 min' },
];

const TRAINING_DAY_PATTERNS = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
};

const FULL_BODY_TEMPLATE = ['legs', 'push', 'pull', 'core'];
const PPL_TEMPLATE = {
  push: ['push', 'push', 'arms'],
  pull: ['pull', 'pull', 'arms'],
  legs: ['legs', 'legs', 'core'],
};

function clampTrainingDays(raw) {
  if (raw === undefined || raw === null || raw === '') return 4;
  const m = String(raw).match(/(\d+)/);
  if (m) return Math.min(6, Math.max(2, Number(m[1])));
  return 4;
}

function filterSafeFoods(list, foodMatcher, budgetMatcher) {
  const out = list.filter((f) => {
    if (foodMatcher(f.name)) return false;
    if (budgetMatcher && budgetMatcher(f.name)) return false;
    return true;
  });
  return out.length ? out : list; // never go empty — degrade gracefully
}

function pickRotating(list, dayIndex) {
  if (!list.length) return null;
  return list[(dayIndex - 1) % list.length];
}

function safeExercisesFor(type, injuries) {
  const pool = SAFE_EXERCISE_POOL.filter((e) => e.type === type);
  const allowed = pool.filter((e) => !isExerciseBlocked(e.name, injuries));
  if (allowed.length) return allowed;
  return SAFE_EXERCISE_POOL.filter((e) => !isExerciseBlocked(e.name, injuries));
}

function buildDietDay(dayIndex, targets, snacksPerDay, foodMatcher, budgetMatcher) {
  const breakfast = pickRotating(filterSafeFoods(SAFE_BREAKFASTS, foodMatcher, budgetMatcher), dayIndex);
  const lunch = pickRotating(filterSafeFoods(SAFE_LUNCHES, foodMatcher, budgetMatcher), dayIndex);
  const dinner = pickRotating(filterSafeFoods(SAFE_DINNERS, foodMatcher, budgetMatcher), dayIndex);
  const snackPool = filterSafeFoods(SAFE_SNACKS, foodMatcher, budgetMatcher);
  const snackEntries = [];
  for (let i = 0; i < snacksPerDay; i += 1) {
    snackEntries.push(pickRotating(snackPool, dayIndex + i));
  }

  // Scale macros so the day's protein meets the 85% validator floor.
  // Cap the multiplier so portions stay realistic.
  const baseProtein =
    (breakfast?.protein || 0) +
    (lunch?.protein || 0) +
    (dinner?.protein || 0) +
    snackEntries.reduce((s, x) => s + (x?.protein || 0), 0);
  const requiredProtein = (targets?.proteinTarget || 0) * 0.95;
  const scale = baseProtein > 0 ? Math.min(2.4, Math.max(1, requiredProtein / baseProtein)) : 1;

  const meals = [];
  function toMeal(slot, food) {
    if (!food) return;
    const protein = Math.round((food.protein || 0) * scale);
    const carbs = Math.round((food.carbs || 0) * scale);
    const fat = Math.round((food.fat || 0) * scale);
    const grams = Math.round((food.grams || 0) * scale);
    const calories = Math.round(protein * 4 + carbs * 4 + fat * 9);
    meals.push({
      slot,
      foodItemId: null,
      webtebId: null,
      name: food.name,
      grams,
      calories,
      protein,
      carbs,
      fat,
      notes: '',
    });
  }
  toMeal('breakfast', breakfast);
  toMeal('lunch', lunch);
  toMeal('dinner', dinner);
  snackEntries.forEach((s) => toMeal('snack', s));

  return { dayIndex, label: '', meals };
}

function buildWorkoutWeek(weekIndex, trainingDays, injuries, split) {
  const trainSet = new Set(TRAINING_DAY_PATTERNS[trainingDays] || TRAINING_DAY_PATTERNS[4]);
  const days = [];
  let rotIdx = 0;
  for (let d = 1; d <= 7; d += 1) {
    if (!trainSet.has(d)) {
      days.push({ dayIndex: d, type: 'rest', label: '', isRest: true, exercises: [] });
      continue;
    }

    let typeOrder;
    if (split === 'ppl') typeOrder = ['push', 'pull', 'legs'];
    else if (split === 'upper_lower') typeOrder = ['push', 'legs', 'pull', 'legs'];
    else typeOrder = FULL_BODY_TEMPLATE;
    const dayType = typeOrder[rotIdx % typeOrder.length];
    rotIdx += 1;

    let exercises;
    if (dayType === 'push' || dayType === 'pull' || dayType === 'legs') {
      const types = PPL_TEMPLATE[dayType];
      exercises = types
        .flatMap((t) => safeExercisesFor(t, injuries).slice(0, 2))
        .slice(0, 5)
        .map((ex) => ({
          exerciseId: null,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          restSec: ex.restSec,
          notes: ex.notes || '',
        }));
    } else {
      // full body
      exercises = FULL_BODY_TEMPLATE.flatMap((t) => safeExercisesFor(t, injuries).slice(0, 1))
        .slice(0, 5)
        .map((ex) => ({
          exerciseId: null,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          restSec: ex.restSec,
          notes: ex.notes || '',
        }));
    }

    if (!exercises.length) {
      days.push({ dayIndex: d, type: 'rest', label: '', isRest: true, exercises: [] });
    } else {
      days.push({ dayIndex: d, type: dayType, label: '', isRest: false, exercises });
    }
  }

  return { weekIndex, days };
}

function pickSplit(onboardingData) {
  const v = String(onboardingData?.preferredSplit || '').toLowerCase();
  if (v.includes('ppl') || v.includes('push')) return 'ppl';
  if (v.includes('upper')) return 'upper_lower';
  return 'full';
}

/**
 * Build a complete fallback plan in the shape expected by the validator
 * (and the Mongoose Plan model).
 */
function buildFallbackPlan({ profile, onboardingData, targets, weeks = 4 } = {}) {
  const od = onboardingData || profile?.onboardingData || {};
  const trainingDays = clampTrainingDays(od.trainingDaysPerWeek);
  const injuries = od.injuries || [];
  const split = pickSplit(od);

  const { foodMatcher, budgetMatcher } = buildExclusionMatchers(od);
  const snacksPerDayRaw = Number(String(od.snacksPerDay || '').match(/\d+/)?.[0]);
  const snacksPerDay = Number.isFinite(snacksPerDayRaw) ? Math.min(2, Math.max(0, snacksPerDayRaw)) : 1;

  const dietDays = [];
  for (let d = 1; d <= 7; d += 1) {
    dietDays.push(buildDietDay(d, targets, snacksPerDay, foodMatcher, budgetMatcher));
  }

  const workoutWeeks = [];
  for (let w = 1; w <= weeks; w += 1) {
    workoutWeeks.push(buildWorkoutWeek(w, trainingDays, injuries, split));
  }

  return {
    dailyTargets: {
      calories: targets.calorieTarget,
      protein: targets.proteinTarget,
      carbs: targets.carbTarget,
      fat: targets.fatTarget,
      waterMl: targets.waterMl,
    },
    dietDays,
    workoutWeeks,
    coachNotes:
      'Safe baseline plan generated automatically. Open the chat coach for personalized adjustments.',
    regenerationReason: 'fallback',
  };
}

module.exports = {
  buildFallbackPlan,
  SAFE_BREAKFASTS,
  SAFE_LUNCHES,
  SAFE_DINNERS,
  SAFE_SNACKS,
  SAFE_EXERCISE_POOL,
};
