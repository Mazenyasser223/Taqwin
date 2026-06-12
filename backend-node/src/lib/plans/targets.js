/**
 * Single source of truth for daily nutrition + water targets.
 *
 * Used by:
 *   - Dashboard            (athletePersonalization.estimateTargets)
 *   - AI coach context     (contextBundle)
 *   - AI plan generator    (Phase 5)
 *   - Plan validator       (Phase 3)
 *
 * Inputs come from `Profile` (weight, fitnessGoal, dateOfBirth) and the
 * questionnaire JSON stored in `Profile.onboardingData`.
 */

const DEFAULT_WEIGHT_KG = 70;
const ABSOLUTE_MIN_CALORIES = 1200;
// Gender-aware safety floors used by both the dashboard (estimateDailyTargets)
// and the plan validator. Higher than ABSOLUTE_MIN_CALORIES because adult
// athletes shouldn't drop below this unless a coach explicitly overrides.
const SAFETY_MIN_CALORIES_MEN = 1700;
const SAFETY_MIN_CALORIES_WOMEN = 1500;

function safetyFloorForProfile(profile) {
  const hasMedical = Boolean(String(profile?.medicalNotes || '').trim());
  if (hasMedical) return ABSOLUTE_MIN_CALORIES;
  const gender = String(profile?.gender || '').toLowerCase();
  if (gender.includes('female') || gender.includes('woman')) return SAFETY_MIN_CALORIES_WOMEN;
  return SAFETY_MIN_CALORIES_MEN;
}

const GOAL_KCAL_PER_KG = {
  lose: 22,
  muscle: 26,
  maintain: 24,
};

const GOAL_PROTEIN_PER_KG = {
  lose: 2.0,
  muscle: 2.2,
  maintain: 1.6,
};

/**
 * Calorie deltas for the questionnaire `calorieTarget` option string.
 * Applied to maintenance kcal (weight x 24) when present.
 * `coach` returns null so callers fall back to the goal-based formula.
 */
const CALORIE_DELTAS = {
  coach: null,
  deficit_aggressive: -500,
  deficit_mild: -300,
  maintain: 0,
  surplus: 300,
};

const WATER_BUCKETS_ML = {
  coffee: 1500,
  lt2: 2000,
  '2-6': 2500,
  '7-10': 3000,
  gt10: 3500,
};

const DEFAULT_WATER_ML = 2500;

const CARB_PCT = 0.45;
const FAT_PCT = 0.25;
const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARB = 4;
const KCAL_PER_G_FAT = 9;

function bucketGoal(rawGoal) {
  const g = String(rawGoal || '').toLowerCase();
  if (g.includes('lose') || g.includes('weight') || g.includes('fat') || g.includes('cut')) {
    return 'lose';
  }
  if (g.includes('muscle') || g.includes('build') || g.includes('gain')) return 'muscle';
  return 'maintain';
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function maintenanceCalories(weightKg, goal = 'maintain') {
  const mult = GOAL_KCAL_PER_KG[goal] ?? GOAL_KCAL_PER_KG.maintain;
  return Math.round(weightKg * mult);
}

function proteinForGoal(weightKg, goal = 'maintain') {
  const mult = GOAL_PROTEIN_PER_KG[goal] ?? GOAL_PROTEIN_PER_KG.maintain;
  return Math.round(weightKg * mult);
}

/**
 * Map an onboarding `calorieTarget` option to a final calorie number.
 * Returns null when no preference (option `coach` or unknown) so the caller
 * can keep the goal-based formula default.
 */
function mapCalorieTargetOption(option, maintenance) {
  if (!option || option === 'coach') return null;
  const delta = CALORIE_DELTAS[option];
  if (delta == null || !Number.isFinite(delta)) return null;
  return Math.max(0, Math.round(maintenance + delta));
}

function waterTargetMl(onboardingData) {
  if (!onboardingData) return DEFAULT_WATER_ML;
  const key = onboardingData.water;
  return WATER_BUCKETS_ML[key] ?? DEFAULT_WATER_ML;
}

function macroSplitFromCalories(calorieTarget, proteinTarget) {
  const proteinCals = proteinTarget * KCAL_PER_G_PROTEIN;
  const remaining = Math.max(0, calorieTarget - proteinCals);
  return {
    carbTarget: Math.round((remaining * CARB_PCT) / KCAL_PER_G_CARB),
    fatTarget: Math.round((remaining * FAT_PCT) / KCAL_PER_G_FAT),
  };
}

function parseIntFromAnswer(raw, fallback) {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const m = String(raw).match(/(\d+)/);
  if (!m) return fallback;
  return Number(m[1]);
}

function parseMealsCount(raw) {
  const n = parseIntFromAnswer(raw, 4);
  return Math.min(6, Math.max(0, n));
}

function parseSnacksCount(raw) {
  const n = parseIntFromAnswer(raw, 0);
  return Math.min(4, Math.max(0, n));
}

/**
 * Estimate the user's daily targets from profile + onboarding.
 *
 * @param {object|null} profile - Postgres Profile row (weight, fitnessGoal, onboardingData)
 * @param {object|null} [onboardingData] - explicit onboarding override; defaults to profile.onboardingData
 * @returns {{ calorieTarget:number, proteinTarget:number, carbTarget:number, fatTarget:number, waterMl:number }}
 */
function estimateDailyTargets(profile, onboardingData) {
  const od =
    onboardingData ??
    (profile?.onboardingData && typeof profile.onboardingData === 'object'
      ? profile.onboardingData
      : {});

  const weight = profile?.weight ?? DEFAULT_WEIGHT_KG;
  const goal = bucketGoal(profile?.fitnessGoal);

  let calorieTarget = maintenanceCalories(weight, goal);
  let proteinTarget = proteinForGoal(weight, goal);

  const customCal = num(od.calorieTarget);
  if (customCal) {
    calorieTarget = Math.round(customCal);
  } else {
    const maintenance = maintenanceCalories(weight, 'maintain');
    const mapped = mapCalorieTargetOption(od.calorieTarget, maintenance);
    if (mapped != null) calorieTarget = mapped;
  }

  const customProtein = num(od.proteinTarget);
  if (customProtein) {
    proteinTarget = Math.round(customProtein);
  } else if (String(od.dietType || '').toLowerCase().includes('high') && profile?.weight) {
    proteinTarget = Math.round(profile.weight * 2.2);
  }

  const meals = parseMealsCount(od.mealsPerDay);
  const snacks = parseSnacksCount(od.snacksPerDay);
  if (meals + snacks >= 5) {
    proteinTarget = Math.round(proteinTarget * 1.05);
  }

  const floor = safetyFloorForProfile(profile);
  calorieTarget = Math.max(floor, calorieTarget);

  const { carbTarget, fatTarget } = macroSplitFromCalories(calorieTarget, proteinTarget);

  return {
    calorieTarget,
    proteinTarget,
    carbTarget,
    fatTarget,
    waterMl: waterTargetMl(od),
  };
}

function ageFromDateOfBirth(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

module.exports = {
  ABSOLUTE_MIN_CALORIES,
  SAFETY_MIN_CALORIES_MEN,
  SAFETY_MIN_CALORIES_WOMEN,
  CALORIE_DELTAS,
  WATER_BUCKETS_ML,
  GOAL_KCAL_PER_KG,
  GOAL_PROTEIN_PER_KG,
  DEFAULT_WATER_ML,
  DEFAULT_WEIGHT_KG,
  bucketGoal,
  mapCalorieTargetOption,
  maintenanceCalories,
  proteinForGoal,
  safetyFloorForProfile,
  waterTargetMl,
  estimateDailyTargets,
  ageFromDateOfBirth,
  parseMealsCount,
  parseSnacksCount,
};
