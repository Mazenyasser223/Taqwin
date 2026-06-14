import type { AppLanguage } from '../../../services/settingsService';
import type { OnboardingStep } from '../types';
import { enrichStep } from '../stepEnrichment';
import { localizeFlowSteps, localizeQuestionnaireStep } from './localeAr';
import { RAW_ATHLETE_STEPS } from '../athleteSteps';
import { EXTRA_QUESTIONNAIRE_STEPS } from './extraSteps';
import { FEMALE_HEALTH_STEPS } from './femaleHealthSteps';
import { adaptWorkoutStep, shouldSkipWorkoutStep } from './workoutAdaptive';
import { adaptWellnessStep, shouldSkipWellnessStep } from './wellnessAdaptive';
import { FLOW_STEP_ORDERS } from './orders';
import type { QuestionnaireFlowId } from './types';

const ALL_STEPS_BY_ID = new Map<string, OnboardingStep>(
  [...RAW_ATHLETE_STEPS, ...EXTRA_QUESTIONNAIRE_STEPS, ...FEMALE_HEALTH_STEPS].map((s) => [s.id, s]),
);

function resolveSteps(order: string[]): OnboardingStep[] {
  return order.map((id) => {
    const step = ALL_STEPS_BY_ID.get(id);
    if (!step) throw new Error(`Unknown questionnaire step: ${id}`);
    return enrichStep(step);
  });
}

/** Steps skipped based on prior answers (per flow). */
function isLoseWeightGoal(primaryGoal: unknown): boolean {
  const g = String(primaryGoal ?? '').toLowerCase();
  return g.includes('lose') || g.includes('weight') || g.includes('fat');
}

export function shouldSkipStepForFlow(
  flow: QuestionnaireFlowId,
  stepId: string,
  answers: Record<string, unknown>,
  profileGender?: string | null,
): boolean {
  if (flow === 'core') {
    if (stepId === 'targetWeight' && !isLoseWeightGoal(answers.primaryGoal)) return true;
  }
  if (flow === 'workout') {
    return shouldSkipWorkoutStep(stepId, answers);
  }
  if (flow === 'wellness') {
    return shouldSkipWellnessStep(stepId, answers, profileGender);
  }
  return false;
}

export function getQuestionnaireStep(stepId: string): OnboardingStep | undefined {
  const step = ALL_STEPS_BY_ID.get(stepId);
  return step ? enrichStep(step) : undefined;
}

export function getLocalizedQuestionnaireStep(
  stepId: string,
  language: AppLanguage = 'ar',
): OnboardingStep | undefined {
  const step = getQuestionnaireStep(stepId);
  if (!step) return undefined;
  if (language === 'ar') return localizeQuestionnaireStep(step);
  return step;
}

export function getActiveStepsForFlow(
  flow: QuestionnaireFlowId,
  answers: Record<string, unknown>,
  language: AppLanguage = 'ar',
  profileGender?: string | null,
): OnboardingStep[] {
  const order = FLOW_STEP_ORDERS[flow];
  const steps = resolveSteps(order)
    .filter((s) => !shouldSkipStepForFlow(flow, s.id, answers, profileGender))
    .map((s) => {
      if (flow === 'workout') return adaptWorkoutStep(s, answers);
      if (flow === 'wellness') return adaptWellnessStep(s, answers, profileGender);
      return s;
    });
  if (language === 'ar') {
    return localizeFlowSteps(flow, steps);
  }
  return steps;
}
