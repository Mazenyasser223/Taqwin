/**
 * Extract onboarding questionnaire answers for AI coach / CAG (Block A5).
 * Field lists mirror frontend `features/onboarding/flows/orders.ts`.
 */

const CORE_FIELDS = [
  'displayName',
  'gender',
  'age',
  'phone',
  'height',
  'weight',
  'bodyType',
  'bodyMeasurements',
  'primaryGoal',
  'activityLevel',
  'fitnessLevel',
  'lastTraining',
  'otherSports',
  'upcomingEvent',
  'planFailed',
  'inbodyScan',
  'progressPhotos',
];

const WORKOUT_FIELDS = [
  'injuries',
  'goal12Week',
  'bodyFocus',
  'trainingDaysPerWeek',
  'workoutLocation',
  'gymLink',
  'workoutTime',
  'workoutDuration',
  'preferredSplit',
  'exercisesAvoid',
  'exercisesLove',
  'pushups',
  'squats',
  'pullups',
  'benchMax',
  'deadliftMax',
  'addCardio',
  'equipment',
  'strengthEquipment',
  'goal12WeekPace',
  'restDaysPreference',
  'liftExperience',
];

const NUTRITION_FIELDS = [
  'foodAllergies',
  'foodsExcluded',
  'foodsExcludedCustom',
  'dietType',
  'diet',
  'mealPlanStyle',
  'mealsPerDay',
  'snacksPerDay',
  'targetWeight',
  'proteinPrefs',
  'carbPrefs',
  'fatPrefs',
  'fruitPrefs',
  'dairyPrefs',
  'water',
  'eatingHabits',
  'supplementsBudget',
  'foodBudget',
  'mealPrepTime',
  'cookOrReady',
  'religiousDiet',
];

const HEALTH_FIELDS = [
  'medicalHistory',
  'medications',
  'pastInjuriesHistory',
  'doctorClearance',
  'sleep',
  'progressTracking',
  'hungerScale',
  'motivationStart',
  'stressCoping',
  'exerciseAttitude',
  'feelings',
  'bodyFat',
  'physique',
  'targetPhysique',
  'successMetrics',
  'trackProgress',
  'motivation',
  'confidence',
];

const BODY_TYPE_LABELS = {
  ectomorph: { en: 'Ectomorph (lean, hard to gain)', ar: 'نحيف (إكتومورف)' },
  mesomorph: { en: 'Mesomorph (athletic build)', ar: 'رياضي (ميزومورف)' },
  endomorph: { en: 'Endomorph (stores fat easily)', ar: 'يميل لتخزين الدهون (إندومورف)' },
};

function arr(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function isEmptyValue(v) {
  if (v == null || v === '') return true;
  if (Array.isArray(v)) return v.length === 0 || v.every((x) => x == null || x === '' || x === 'none');
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

function formatScalar(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v.trim() || null;
  return null;
}

function formatArray(v) {
  const items = arr(v).filter((x) => x !== 'none');
  if (!items.length) return null;
  return items
    .map((item) => {
      if (typeof item === 'object' && item !== null) {
        return item.name || item.label || item.value || JSON.stringify(item);
      }
      return String(item);
    })
    .join(', ');
}

function formatFieldValue(key, raw) {
  if (isEmptyValue(raw)) return null;
  if (key === 'bodyType') {
    const k = String(raw).toLowerCase();
    const labels = BODY_TYPE_LABELS[k];
    return labels ? `${k} — ${labels.en}` : String(raw);
  }
  if (key === 'bodyMeasurements' && typeof raw === 'object' && raw !== null) {
    const parts = Object.entries(raw)
      .map(([k, val]) => (val != null && val !== '' ? `${k}: ${val}` : null))
      .filter(Boolean);
    return parts.length ? parts.join('; ') : null;
  }
  if (Array.isArray(raw)) return formatArray(raw);
  if (typeof raw === 'object') {
    try {
      const s = JSON.stringify(raw);
      return s.length <= 200 ? s : `${s.slice(0, 197)}…`;
    } catch {
      return null;
    }
  }
  return formatScalar(raw);
}

function pickSection(data, fields) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const key of fields) {
    if (!(key in data)) continue;
    const formatted = formatFieldValue(key, data[key]);
    if (formatted != null) out[key] = formatted;
  }
  return out;
}

function buildFlatLegacy(data, sections) {
  const o = data && typeof data === 'object' ? data : {};
  const injuries = arr(o.injuries).filter((i) => i !== 'none');
  const foodAllergies = arr(o.foodAllergies).filter(Boolean);
  const diet = arr(o.diet);
  if (o.dietType && !diet.includes(o.dietType)) diet.push(String(o.dietType));

  return {
    primaryGoal: o.primaryGoal != null ? String(o.primaryGoal) : sections.core.primaryGoal ?? null,
    bodyType: sections.core.bodyType ?? (o.bodyType != null ? String(o.bodyType) : null),
    diet,
    eatingHabits: sections.nutrition.eatingHabits ?? formatArray(o.eatingHabits),
    injuries,
    foodAllergies,
    foodsExcluded: arr(o.foodsExcluded),
    foodsExcludedCustom: o.foodsExcludedCustom != null ? String(o.foodsExcludedCustom) : null,
    workoutLocation: sections.workout.workoutLocation ?? (o.workoutLocation != null ? String(o.workoutLocation) : null),
    activityLevel: sections.core.activityLevel ?? (o.activityLevel != null ? String(o.activityLevel) : null),
    targetPhysique: sections.core.targetPhysique ?? sections.health.targetPhysique ?? null,
    fitnessLevel: sections.core.fitnessLevel ?? (o.fitnessLevel != null ? String(o.fitnessLevel) : null),
    religiousDiet: sections.nutrition.religiousDiet ?? (o.religiousDiet != null ? String(o.religiousDiet) : null),
    foodBudget: sections.nutrition.foodBudget ?? null,
    dietType: sections.nutrition.dietType ?? null,
    trainingDaysPerWeek: sections.workout.trainingDaysPerWeek ?? null,
    preferredSplit: sections.workout.preferredSplit ?? null,
    exercisesAvoid: arr(o.exercisesAvoid),
    exercisesLove: arr(o.exercisesLove),
    medicalHistory: sections.health.medicalHistory ?? null,
    medications: sections.health.medications ?? null,
    sleep: sections.health.sleep ?? null,
  };
}

/**
 * @param {object|null|undefined} onboardingData
 * @returns {{
 *   core: Record<string, string>,
 *   workout: Record<string, string>,
 *   nutrition: Record<string, string>,
 *   health: Record<string, string>,
 *   flat: object,
 * }}
 */
function extractOnboardingForCoach(onboardingData) {
  const data = onboardingData && typeof onboardingData === 'object' ? onboardingData : {};
  const core = pickSection(data, CORE_FIELDS);
  const workout = pickSection(data, WORKOUT_FIELDS);
  const nutrition = pickSection(data, NUTRITION_FIELDS);
  const health = pickSection(data, HEALTH_FIELDS);
  const flat = buildFlatLegacy(data, { core, workout, nutrition, health });

  return { core, workout, nutrition, health, flat };
}

function formatSectionLines(section, title) {
  const keys = Object.keys(section);
  if (!keys.length) return [];
  const lines = [`--- ${title} ---`];
  for (const key of keys) {
    lines.push(`${key}: ${section[key]}`);
  }
  return lines;
}

/**
 * @param {ReturnType<typeof extractOnboardingForCoach>} extracted
 */
function formatOnboardingForPrompt(extracted) {
  if (!extracted) return '';
  const parts = [
    ...formatSectionLines(extracted.core, 'ONBOARDING — CORE'),
    ...formatSectionLines(extracted.workout, 'ONBOARDING — WORKOUT'),
    ...formatSectionLines(extracted.nutrition, 'ONBOARDING — NUTRITION'),
    ...formatSectionLines(extracted.health, 'ONBOARDING — HEALTH'),
  ];
  return parts.length ? parts.join('\n') : '';
}

function bodyTypeLabel(bodyType, locale = 'ar') {
  const k = String(bodyType || '').toLowerCase();
  const labels = BODY_TYPE_LABELS[k];
  if (!labels) return bodyType ? String(bodyType) : null;
  return locale === 'en' ? labels.en : labels.ar;
}

module.exports = {
  CORE_FIELDS,
  WORKOUT_FIELDS,
  NUTRITION_FIELDS,
  HEALTH_FIELDS,
  extractOnboardingForCoach,
  formatOnboardingForPrompt,
  bodyTypeLabel,
  formatFieldValue,
};
