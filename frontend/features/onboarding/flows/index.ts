import type { AppLanguage } from '../../../services/settingsService';
import type { OnboardingStep } from '../types';
import { enrichStep } from '../stepEnrichment';
import { localizeFlowSteps } from './localeAr';
import { RAW_ATHLETE_STEPS } from '../athleteSteps';
import { EXTRA_QUESTIONNAIRE_STEPS } from './extraSteps';
import { FLOW_STEP_ORDERS } from './orders';
import type { QuestionnaireFlowId } from './types';

const ALL_STEPS_BY_ID = new Map<string, OnboardingStep>(
  [...RAW_ATHLETE_STEPS, ...EXTRA_QUESTIONNAIRE_STEPS].map((s) => [s.id, s]),
);

function resolveSteps(order: string[]): OnboardingStep[] {
  return order.map((id) => {
    const step = ALL_STEPS_BY_ID.get(id);
    if (!step) throw new Error(`Unknown questionnaire step: ${id}`);
    return enrichStep(step);
  });
}

/** Steps skipped based on prior answers (per flow). */
export function shouldSkipStepForFlow(
  flow: QuestionnaireFlowId,
  stepId: string,
  answers: Record<string, unknown>,
): boolean {
  if (flow === 'workout') {
    if (stepId === 'equipment' && answers.addCardio !== 'yes') return true;
    if (stepId === 'gymLink' && answers.workoutLocation !== 'Gym') return true;
  }
  return false;
}

export function getActiveStepsForFlow(
  flow: QuestionnaireFlowId,
  answers: Record<string, unknown>,
  language: AppLanguage = 'ar',
): OnboardingStep[] {
  const order = FLOW_STEP_ORDERS[flow];
  const steps = resolveSteps(order).filter((s) => !shouldSkipStepForFlow(flow, s.id, answers));
  if (language === 'ar') {
    return localizeFlowSteps(flow, steps);
  }
  return steps;
}
