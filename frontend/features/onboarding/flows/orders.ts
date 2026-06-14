import type { QuestionnaireFlowId } from './types';
import { FEMALE_HEALTH_STEP_IDS } from './femaleHealthSteps';

/** Core onboarding — 20 steps (targetWeight adaptive on Lose Weight) */
export const CORE_STEP_ORDER: string[] = [
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
];

/** Workout plan questionnaire */
export const WORKOUT_STEP_ORDER: string[] = [
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
];

/** Diet plan questionnaire */
export const DIET_STEP_ORDER: string[] = [
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
];

/** General health + feelings, then optional female health (female athletes only) */
export const WELLNESS_STEP_ORDER: string[] = [
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
];

export const FLOW_STEP_ORDERS: Record<QuestionnaireFlowId, string[]> = {
  core: CORE_STEP_ORDER,
  workout: WORKOUT_STEP_ORDER,
  diet: DIET_STEP_ORDER,
  wellness: WELLNESS_STEP_ORDER,
};
