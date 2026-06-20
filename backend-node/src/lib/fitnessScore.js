/**
 * Daily Fitness Score — mirrors frontend/features/dashboard/fitnessScore.ts.
 * Weighted pillars: sleep 20%, meals 30%, water 20%, workout 30% = 0–100.
 */

const PILLAR_WEIGHTS = {
  sleep: 20,
  meals: 30,
  water: 20,
  workout: 30,
};
const SLEEP_MIN_HOURS = 6;
const SLEEP_MAX_HOURS = 11;
const CALORIE_TOLERANCE = 300;
const CALORIE_PENALTY_RANGE = 600;

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Derive typical sleep duration (hours) from onboarding sleep band. */
function sleepHoursFromPreference(sleep) {
  const key = String(sleep || '').toLowerCase();
  if (key.includes('lt5') || key.includes('fewer')) return 4.5;
  if (key === '5-6' || key.includes('5–6') || key.includes('5-6')) return 5.5;
  if (key === '7-8' || key.includes('7–8') || key.includes('7-8')) return 7.5;
  if (key.includes('gt8') || key.includes('over 8')) return 8.5;
  const m = key.match(/(\d+)/g);
  if (m?.length) return Math.min(10, Math.max(4, Number(m[0])));
  return 7;
}

function mealProgressFromCalories(eaten, target) {
  if (eaten <= 0 || target <= 0) return 0;
  const deviation = Math.abs(eaten - target);
  if (deviation <= CALORIE_TOLERANCE) return 1;
  const excess = deviation - CALORIE_TOLERANCE;
  return clamp01(1 - excess / CALORIE_PENALTY_RANGE);
}

function sleepProgressFromHours(hours) {
  if (hours >= SLEEP_MIN_HOURS && hours <= SLEEP_MAX_HOURS) return 1;
  if (hours < SLEEP_MIN_HOURS) return clamp01((hours / SLEEP_MIN_HOURS) * 0.75);
  const excess = hours - SLEEP_MAX_HOURS;
  return clamp01(1 - excess / 4);
}

function scoreFromPillarProgress(progress) {
  return Math.round(
    clamp01(progress.sleep) * PILLAR_WEIGHTS.sleep +
      clamp01(progress.meals) * PILLAR_WEIGHTS.meals +
      clamp01(progress.water) * PILLAR_WEIGHTS.water +
      clamp01(progress.workout) * PILLAR_WEIGHTS.workout
  );
}

/**
 * @param {{
 *   sleepHours?: number,
 *   sleepPreference?: string | null,
 *   caloriesEaten?: number,
 *   calorieTarget?: number,
 *   waterCurrentMl?: number,
 *   waterTargetMl?: number,
 *   workoutProgress?: number,
 * }} input
 */
function computeFitnessScoreFromInputs(input) {
  const sleepHours =
    input.sleepHours != null && Number.isFinite(input.sleepHours)
      ? input.sleepHours
      : sleepHoursFromPreference(input.sleepPreference);

  const sleepProg = sleepProgressFromHours(sleepHours);
  const mealsProg = mealProgressFromCalories(
    input.caloriesEaten ?? 0,
    input.calorieTarget ?? 0
  );
  const waterTarget = input.waterTargetMl ?? 2500;
  const waterCurrent = input.waterCurrentMl ?? 0;
  const waterProg = waterTarget > 0 ? clamp01(waterCurrent / waterTarget) : 0;
  const workoutProg = clamp01(input.workoutProgress ?? 0);

  const sleepPts = sleepProg * PILLAR_WEIGHTS.sleep;
  const mealsPts = mealsProg * PILLAR_WEIGHTS.meals;
  const waterPts = waterProg * PILLAR_WEIGHTS.water;
  const workoutPts = workoutProg * PILLAR_WEIGHTS.workout;
  const score = Math.round(sleepPts + mealsPts + waterPts + workoutPts);

  return {
    score,
    sleepPts,
    mealsPts,
    waterPts,
    workoutPts,
    pillars: {
      sleep: sleepProg,
      meals: mealsProg,
      water: waterProg,
      workout: workoutProg,
    },
  };
}

module.exports = {
  PILLAR_WEIGHTS,
  SLEEP_MIN_HOURS,
  SLEEP_MAX_HOURS,
  CALORIE_TOLERANCE,
  CALORIE_PENALTY_RANGE,
  clamp01,
  sleepHoursFromPreference,
  mealProgressFromCalories,
  sleepProgressFromHours,
  scoreFromPillarProgress,
  computeFitnessScoreFromInputs,
};
