/** Local onboarding assets (Vite public → /assets/onboarding/) */
const BASE = '/assets/onboarding';

export function onboardingAsset(
  key: string,
  ext: 'svg' | 'png' | 'jpg' | 'webp' = 'svg',
): string {
  return `${BASE}/${key}.${ext}`;
}

/** Semantic SVG illustrations — one distinct visual per option */
function ill(key: string): string {
  return onboardingAsset(key, 'svg');
}

/** Male-focused photos — gender + welcome coach */
function photo(key: string): string {
  return onboardingAsset(key, 'png');
}

export const ASSETS = {
  genderMale: photo('gender-male'),
  genderFemale: photo('gender-female'),
  coachWelcome: photo('coach-welcome'),

  heroStrength: ill('hero-strength'),
  default: ill('default'),

  goalMuscle: ill('goal-muscle'),
  goalWeight: ill('goal-weight'),
  goalEndurance: ill('goal-endurance'),
  goalWellness: ill('goal-wellness'),

  physiqueLean: ill('physique-lean'),
  physiqueMuscular: ill('physique-muscular'),
  physiqueRipped: ill('physique-ripped'),

  workoutHome: ill('workout-home'),
  workoutGym: ill('workout-gym'),
  workoutMixed: ill('workout-mixed'),

  levelBeginner: ill('level-beginner'),
  levelIntermediate: ill('level-intermediate'),
  levelAdvanced: ill('level-advanced'),

  bodyEctomorph: ill('body-ectomorph'),
  bodyMesomorph: ill('body-mesomorph'),
  bodyEndomorph: ill('body-endomorph'),

  age1829: ill('age-18-29'),
  age3039: ill('age-30-39'),
  age4049: ill('age-40-49'),
  age50plus: ill('age-50-plus'),

  bodyFat1: onboardingAsset('body-fat-1', 'jpg'),
  bodyFat2: onboardingAsset('body-fat-2', 'jpg'),
  bodyFat3: onboardingAsset('body-fat-3', 'jpg'),
  bodyFat4: onboardingAsset('body-fat-4', 'jpg'),
  bodyFat5: onboardingAsset('body-fat-5', 'jpg'),
  bodyFat6: onboardingAsset('body-fat-6', 'jpg'),
  bodyFat7: onboardingAsset('body-fat-7', 'jpg'),

  injuryNone: ill('injury-none'),
  injuryBack: ill('injury-back'),
  injuryKnees: ill('injury-knees'),
  injuryShoulders: ill('injury-shoulders'),
  injuryNeck: ill('injury-neck'),
  injuryArms: ill('injury-arms'),
  injuryElbows: ill('injury-elbows'),
  injuryLegs: ill('injury-legs'),

  pastTrainer: ill('past-trainer'),
  pastApps: ill('past-apps'),
  pastVideos: ill('past-videos'),
  pastSelf: ill('past-self'),
  pastNone: ill('past-none'),

  pushFew: ill('push-few'),
  pushMid: ill('push-mid'),
  pushMany: ill('push-many'),

  squatFew: ill('squat-few'),
  squatMid: ill('squat-mid'),
  squatMany: ill('squat-many'),

  gymLarge: ill('gym-large'),
  gymSmall: ill('gym-small'),
  gymGarage: ill('gym-garage'),
  gymHome: ill('gym-home'),

  cardioYes: ill('cardio-yes'),
  cardioNo: ill('cardio-no'),

  timeMorning: ill('time-morning'),
  timeAfternoon: ill('time-afternoon'),
  timeEvening: ill('time-evening'),
  timeVaries: ill('time-varies'),

  duration30: ill('push-few'),
  duration45: ill('push-mid'),
  duration60: ill('level-intermediate'),
  duration90: ill('level-advanced'),

  sleepLt5: ill('sleep-lt5'),
  sleep56: ill('sleep-56'),
  sleep78: ill('sleep-78'),
  sleepGt8: ill('sleep-gt8'),

  waterCoffee: ill('water-coffee'),
  waterLt2: ill('water-lt2'),
  waterMid: ill('water-mid'),
  waterHigh: ill('water-high'),

  dietNone: ill('diet-none'),
  dietVeg: ill('diet-veg'),
  dietGluten: ill('diet-none'),
  dietLactose: ill('water-mid'),
  dietNuts: ill('diet-none'),

  eatingEmotional: ill('goal-wellness'),
  eatingBored: ill('water-coffee'),
  eatingUnconscious: ill('body-endomorph'),
  eatingHabitual: ill('diet-none'),
  eatingEnergy: ill('goal-muscle'),

  walkLt1: ill('push-few'),
  walk12: ill('goal-endurance'),
  walkGt2: ill('cardio-yes'),

  exerciseNecessary: ill('level-intermediate'),
  exerciseInconvenient: ill('sleep-lt5'),
  exerciseEnjoyable: ill('goal-wellness'),

  motivationVisual: ill('motivation-visual'),
  motivationFitness: ill('motivation-fitness'),
  motivationHealth: ill('goal-wellness'),
  motivationClothing: ill('physique-lean'),
  motivationAging: ill('age-50-plus'),

  confidenceHigh: ill('confidence-high'),
  confidenceReasonable: ill('level-intermediate'),
  confidenceOptimistic: ill('goal-wellness'),
  confidenceLow: ill('confidence-low'),

  eventVacation: ill('goal-wellness'),
  eventWedding: ill('physique-lean'),
  eventBirthday: ill('goal-muscle'),
  eventNone: ill('default'),

  planFailedYes: ill('confidence-low'),
  planFailedNo: ill('confidence-high'),

  trackerYes: ill('past-apps'),
  trackerNo: ill('default'),

  sportCardio: ill('cardio-yes'),
  sportFlexibility: ill('goal-wellness'),
  sportMartial: ill('level-advanced'),
  sportTeam: ill('workout-gym'),
  sportNone: ill('default'),

  activityNutrition: ill('diet-none'),
  activityWeights: ill('goal-muscle'),
  activityCardio: ill('cardio-yes'),
  activityBodyweight: ill('workout-home'),
  activitySports: ill('workout-gym'),

  metricMuscle: ill('goal-muscle'),
  metricStrength: ill('level-advanced'),
  metricEndurance: ill('goal-endurance'),
  metricWeightLoss: ill('goal-weight'),
  metricMeasurements: ill('physique-lean'),
  metricWellbeing: ill('goal-wellness'),

  focusFullBody: ill('level-intermediate'),
  focusShoulders: ill('injury-shoulders'),
  focusBiceps: ill('injury-arms'),
  focusBack: ill('injury-back'),
  focusChest: ill('goal-muscle'),
  focusCore: ill('physique-lean'),
  focusGlutes: ill('squat-mid'),
  focusLegs: ill('injury-legs'),

  progressHeavier: ill('level-advanced'),
  progressMilestones: ill('confidence-high'),
  progressReps: ill('push-mid'),
  progressCompounds: ill('goal-muscle'),

  feelingEnergized: ill('cardio-yes'),
  feelingConfident: ill('confidence-high'),
  feelingRelaxed: ill('goal-wellness'),
  feelingAccomplished: ill('motivation-visual'),

  stressExercise: ill('workout-gym'),
  stressCreative: ill('goal-wellness'),
  stressOutdoors: ill('cardio-yes'),
  stressEating: ill('diet-none'),

  paceFast: ill('level-advanced'),
  paceSteady: ill('level-intermediate'),
  paceBalanced: ill('goal-wellness'),

  equipmentTreadmill: ill('equipment-treadmill'),
  equipmentBike: ill('equipment-bike'),
  equipmentAssaultBike: ill('equipment-bike'),
  equipmentElliptical: ill('equipment-elliptical'),
  equipmentStepper: ill('equipment-elliptical'),
  equipmentRower: ill('equipment-rower'),
} as const;

export function optionImage(imageKey?: string): string | undefined {
  if (!imageKey) return undefined;
  return onboardingAsset(imageKey, 'svg');
}
