import type { OnboardingStep } from './types';

/** Card-style full-screen questionnaire (default for all steps). */
export const CARD_STEP_IDS = new Set<string>();

export function getStepPresentation(step: OnboardingStep): 'card' | 'chat' | 'hero' {
  if (step.type === 'hero') return 'hero';
  if (step.type === 'generating' || step.type === 'summary') return 'card';
  return 'card';
}

export function isChatPhase(_step: OnboardingStep): boolean {
  return false;
}
