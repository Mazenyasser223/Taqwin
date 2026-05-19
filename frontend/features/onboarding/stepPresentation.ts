import type { OnboardingStep } from './types';

/** Card-style full-screen picks (none — goal/location moved to chat). */
export const CARD_STEP_IDS = new Set<string>();

export function getStepPresentation(step: OnboardingStep): 'card' | 'chat' | 'hero' {
  if (step.type === 'hero') return 'hero';
  if ('presentation' in step && step.presentation) return step.presentation;
  if (CARD_STEP_IDS.has(step.id)) return 'card';
  if (step.type === 'generating' || step.type === 'summary') return 'chat';
  return 'chat';
}

export function isChatPhase(step: OnboardingStep): boolean {
  const p = getStepPresentation(step);
  return p === 'chat';
}
