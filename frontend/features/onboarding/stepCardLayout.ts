import type { OnboardingStep } from './types';

/** Single-select steps rendered as a vertical option list inside the card. */
export const STACKED_SINGLE_SELECT = new Set([
  'upcomingEvent',
  'lastTraining',
]);

/** Card height tier — drives shell + option grid stretch behavior. */
export type StepCardSizeTier = 'compact' | 'medium' | 'large' | 'scroll';

const COMPACT_TEXT_MULTI = new Set([
  'injuries',
  'bodyFocus',
  'otherSports',
  'pastInjuriesHistory',
  'trainingObstacle',
  'foodAllergies',
  'religiousDiet',
  'eatingHabits',
  'medicalHistory',
  'progressTracking',
  'motivationStart',
]);

export { COMPACT_TEXT_MULTI };

export function getStepCardSizeTier(step: OnboardingStep): StepCardSizeTier {
  switch (step.type) {
    case 'text':
    case 'number':
    case 'likert':
    case 'weightOptional':
      return 'compact';
    case 'catalogPicker':
    case 'gymPicker':
    case 'photos':
    case 'measurements':
    case 'inbody':
    case 'mealsSnacks':
    case 'generating':
    case 'slider':
    case 'hero':
      return 'scroll';
    case 'multi':
      if (COMPACT_TEXT_MULTI.has(step.id)) {
        return step.options.length > 8 ? 'large' : 'medium';
      }
      if (step.visualOptions) return 'large';
      return step.options.length > 6 ? 'large' : 'medium';
    case 'single':
      if (STACKED_SINGLE_SELECT.has(step.id)) return 'medium';
      if (step.visualOptions || step.referenceImageUrl || step.followUp) return 'large';
      if (step.id === 'dietType' || step.id === 'water' || step.id === 'eatingHabits') return 'large';
      if (step.id === 'hungerScale' || step.id === 'stressLevel' || step.id === 'energyLevel') return 'medium';
      if (!step.visualOptions && step.options.length > 6) return 'large';
      if (!step.visualOptions && step.options.length <= 4) return 'compact';
      if (step.options.length <= 2) return 'compact';
      return 'medium';
    case 'info':
      return step.variant === 'testimonials' ? 'scroll' : 'medium';
    default:
      return 'medium';
  }
}

/** Whether option grids should stretch to fill the card body. */
export function stepOptionsStretch(tier: StepCardSizeTier): boolean {
  return tier === 'large' || tier === 'scroll';
}

/** @deprecated Use getStepCardSizeTier(step) === 'large' || tier === 'scroll' */
export function stepUsesExpandedCard(step: OnboardingStep): boolean {
  const tier = getStepCardSizeTier(step);
  return tier === 'large' || tier === 'scroll';
}

export function cardStepRootClass(
  isCard: boolean,
  tier: StepCardSizeTier,
  extra = '',
): string {
  if (!isCard) return extra;
  const base =
    tier === 'scroll'
      ? 'flex flex-col flex-1 min-h-0 w-full min-w-0'
      : 'flex flex-col w-full shrink-0 min-w-0';
  return extra ? `${base} ${extra}` : base;
}
