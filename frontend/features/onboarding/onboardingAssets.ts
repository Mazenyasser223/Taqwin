/** Local onboarding illustrations (Vite public → /assets/onboarding/) */
const BASE = '/assets/onboarding';

export function onboardingAsset(key: string): string {
  return `${BASE}/${key}.svg`;
}

export const ASSETS = {
  heroStrength: onboardingAsset('hero-strength'),
  age1829: onboardingAsset('age-18-29'),
  age3039: onboardingAsset('age-30-39'),
  age4049: onboardingAsset('age-40-49'),
  age50plus: onboardingAsset('age-50-plus'),
  genderMale: onboardingAsset('gender-male'),
  genderFemale: onboardingAsset('gender-female'),
  goalMuscle: onboardingAsset('goal-muscle'),
  goalWeight: onboardingAsset('goal-weight'),
  goalEndurance: onboardingAsset('goal-endurance'),
  goalWellness: onboardingAsset('goal-wellness'),
  physiqueLean: onboardingAsset('physique-lean'),
  physiqueMuscular: onboardingAsset('physique-muscular'),
  physiqueRipped: onboardingAsset('physique-ripped'),
  workoutHome: onboardingAsset('workout-home'),
  workoutGym: onboardingAsset('workout-gym'),
  workoutMixed: onboardingAsset('workout-mixed'),
  levelBeginner: onboardingAsset('level-beginner'),
  levelIntermediate: onboardingAsset('level-intermediate'),
  levelAdvanced: onboardingAsset('level-advanced'),
  bodyEctomorph: onboardingAsset('body-ectomorph'),
  bodyMesomorph: onboardingAsset('body-mesomorph'),
  bodyEndomorph: onboardingAsset('body-endomorph'),
  default: onboardingAsset('default'),
} as const;

/** Fallback when a step has no dedicated art */
export function optionImage(imageKey?: string): string | undefined {
  if (!imageKey) return undefined;
  return onboardingAsset(imageKey);
}
