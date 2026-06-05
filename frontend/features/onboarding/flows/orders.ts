import type { QuestionnaireFlowId } from './types';

/** Core onboarding — 17 steps */
export const CORE_STEP_ORDER: string[] = [
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

/** Workout plan questionnaire */
export const WORKOUT_STEP_ORDER: string[] = [
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

/** Diet plan questionnaire */
export const DIET_STEP_ORDER: string[] = [
  'foodAllergies',
  'foodsExcluded',
  'dietType',
  'mealPlanStyle',
  'mealsPerDay',
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

/** General health + feelings */
export const WELLNESS_STEP_ORDER: string[] = [
  'medicalHistory',
  'medications',
  'pastInjuriesHistory',
  'doctorClearance',
  'sleep',
  'progressTracking',
  'hungerScale',
  'motivationStart',
];

export const FLOW_STEP_ORDERS: Record<QuestionnaireFlowId, string[]> = {
  core: CORE_STEP_ORDER,
  workout: WORKOUT_STEP_ORDER,
  diet: DIET_STEP_ORDER,
  wellness: WELLNESS_STEP_ORDER,
};
