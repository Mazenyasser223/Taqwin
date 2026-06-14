/**
 * Questionnaire step manifest — kept in sync with
 * frontend/features/onboarding/flows/orders.ts + femaleHealthSteps.ts
 *
 * Used by coverage tests: wizard steps → DB (onboardingData JSON) → AI coach fields.
 */

const FEMALE_HEALTH_STEP_IDS = [
  'femaleHealthIntro',
  'cycleRegularity',
  'cycleSymptoms',
  'pregnancyStatus',
  'postpartumStatus',
  'breastfeeding',
  'femaleHealthConditions',
  'birthControl',
  'menopause',
  'cycleLength',
];

const FLOW_STEP_ORDERS = {
  core: [
    'displayName',
    'gender',
    'age',
    'phone',
    'height',
    'weight',
    'weightHistory',
    'bodyType',
    'bodyMeasurements',
    'primaryGoal',
    'targetWeight',
    'goalDeadline',
    'activityLevel',
    'fitnessLevel',
    'lastTraining',
    'otherSports',
    'upcomingEvent',
    'planFailed',
    'inbodyScan',
    'progressPhotos',
  ],
  workout: [
    'injuries',
    'bodyFocus',
    'trainingDaysPerWeek',
    'workoutLocation',
    'gymLink',
    'workoutTime',
    'workoutDuration',
    'trainingObstacle',
    'preferredSplit',
    'exercisesAvoid',
    'exercisesLove',
    'pushups',
    'squats',
    'pullups',
    'addCardio',
    'equipment',
    'strengthEquipment',
    'benchMax',
    'deadliftMax',
    'liftExperience',
    'goal12WeekPace',
    'restDaysPreference',
  ],
  diet: [
    'foodAllergies',
    'foodsExcluded',
    'dietType',
    'mealPlanStyle',
    'mealsPerDay',
    'proteinPrefs',
    'carbPrefs',
    'fatPrefs',
    'fruitPrefs',
    'dairyPrefs',
    'water',
    'eatingHabits',
    'weekendEating',
    'supplementsBudget',
    'foodBudget',
    'eatingOutFrequency',
    'preferSimpleMeals',
    'mealPrepTime',
    'cookOrReady',
    'religiousDiet',
  ],
  wellness: [
    'medicalHistory',
    'medications',
    'pastInjuriesHistory',
    'doctorClearance',
    'sleep',
    'recoveryFeel',
    'stressLevel',
    'energyLevel',
    'dailyRoutine',
    'progressTracking',
    'hungerScale',
    'motivationStart',
    ...FEMALE_HEALTH_STEP_IDS,
  ],
};

/** Steps that do not persist a dedicated answer key (intro / UI only). */
const INFO_ONLY_STEP_IDS = new Set(['femaleHealthIntro', 'goalProof']);

/**
 * Step id → onboardingData keys written by the wizard (when answered).
 * Default is [stepId] when not listed.
 */
const STEP_ANSWER_KEYS = {
  bodyMeasurements: ['bodyMeasurements', 'measureChest', 'measureWaist', 'measureHips', 'measureArm'],
  inbodyScan: [
    'inbodyAcknowledged',
    'inbodyBodyMetricId',
    'inbodyReportUrl',
    'inbodyData',
    'inbodyBodyFat',
    'inbodyMuscle',
    'inbodyBmr',
  ],
  progressPhotos: ['progressPhotos', 'photoFrontUrl', 'photoSideUrl', 'photoBackUrl'],
  upcomingEvent: ['upcomingEvent', 'upcomingEventDate', 'upcomingEventOther'],
  planFailed: ['planFailed', 'planFailedReasons', 'planFailedOther'],
  otherSports: ['otherSports', 'otherSportsOther'],
  foodAllergies: ['foodAllergies', 'foodAllergiesOther'],
  injuries: ['injuries', 'injuriesOther'],
  trainingObstacle: ['trainingObstacle', 'trainingObstacleOther'],
  medicalHistory: ['medicalHistory', 'medicalHistoryDetails'],
  foodsExcluded: ['foodsExcluded', 'foodsExcludedCustom'],
  dietType: ['dietType', 'dietTypeOther'],
  exercisesAvoid: ['exercisesAvoid'],
  exercisesLove: ['exercisesLove'],
  restDaysPreference: ['restDaysPreference', 'fixedRestDays'],
  gender: ['gender', 'needsFemaleWellness'],
};

const FLOW_FOR_STEP = (() => {
  const map = new Map();
  for (const [flow, steps] of Object.entries(FLOW_STEP_ORDERS)) {
    for (const stepId of steps) map.set(stepId, flow);
  }
  return map;
})();

function answerKeysForStep(stepId) {
  if (INFO_ONLY_STEP_IDS.has(stepId)) return [];
  return STEP_ANSWER_KEYS[stepId] ?? [stepId];
}

function allCatalogStepIds() {
  const ids = new Set();
  for (const steps of Object.values(FLOW_STEP_ORDERS)) {
    for (const id of steps) ids.add(id);
  }
  return [...ids];
}

module.exports = {
  FEMALE_HEALTH_STEP_IDS,
  FLOW_STEP_ORDERS,
  INFO_ONLY_STEP_IDS,
  STEP_ANSWER_KEYS,
  FLOW_FOR_STEP,
  answerKeysForStep,
  allCatalogStepIds,
};
