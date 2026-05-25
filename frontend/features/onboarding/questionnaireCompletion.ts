import type { AppLanguage } from '../../services/settingsService';
import { getActiveStepsForFlow } from './flows';
import { FLOW_META, type QuestionnaireFlowId } from './flows/types';
import type { OnboardingStep } from './types';

export const QUESTIONNAIRE_META_KEYS = new Set([
  'questionnaireVersion',
  'coreCompletedAt',
  'coreProgressStepIndex',
  'workoutPlanCompletedAt',
  'workoutProgressStepIndex',
  'dietPlanCompletedAt',
  'dietProgressStepIndex',
  'wellnessCompletedAt',
  'wellnessProgressStepIndex',
  'progressStepIndex',
  'inProgress',
  'completedAt',
  'skippedAt',
  'version',
  'lastStepId',
  'savedAt',
  'roleWizard',
  'skippedSteps',
]);

const SKIP_STEP_TYPES = new Set(['info', 'hero', 'generating', 'summary']);

function isOptionalStep(step: OnboardingStep): boolean {
  if ('optional' in step && step.optional === true) return true;
  if (step.type === 'measurements') return true;
  return false;
}

function isStepSkipped(step: OnboardingStep, data: Record<string, unknown>): boolean {
  const skipped = data.skippedSteps;
  return Array.isArray(skipped) && skipped.includes(step.id);
}

export { isStepSkipped };

function stepHasAnswer(step: OnboardingStep, data: Record<string, unknown>): boolean {
  if (step.type === 'info' || step.type === 'hero' || step.type === 'generating' || step.type === 'summary') {
    return true;
  }

  if (isOptionalStep(step) || isStepSkipped(step, data)) {
    return true;
  }

  if (step.type === 'measurements') {
    return ['measureChest', 'measureWaist', 'measureHips', 'measureArm'].some((k) => {
      const v = data[k];
      return v !== undefined && v !== null && v !== '';
    });
  }
  if (step.type === 'inbody') {
    return Boolean(
      data.inbodyAcknowledged || data.inbodyBodyFat || data.inbodyMuscle || data.inbodyBmr,
    );
  }
  if (step.type === 'photos') {
    if (isOptionalStep(step)) return true;
    return Boolean(
      (typeof data.photoFrontUrl === 'string' && data.photoFrontUrl) ||
        (typeof data.photoBackUrl === 'string' && data.photoBackUrl) ||
        data.photoFrontDone ||
        data.photoBackDone,
    );
  }
  if (step.type === 'mealsSnacks') {
    const mealsField = step.mealsField ?? 'mealsPerDay';
    const snacksField = step.snacksField ?? 'snacksPerDay';
    const meals = data[mealsField];
    const snacks = data[snacksField];
    return (
      meals !== undefined &&
      meals !== null &&
      meals !== '' &&
      snacks !== undefined &&
      snacks !== null &&
      snacks !== ''
    );
  }

  const key =
    'field' in step && typeof step.field === 'string' && step.field ? step.field : step.id;
  const v = data[key] ?? data[step.id];
  if (v === undefined || v === null || v === '') return false;
  if (step.type === 'single' && step.followUp?.required) {
    const why = data[step.followUp.field];
    if (typeof why !== 'string' || !why.trim()) return false;
  }
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

function countableSteps(
  data: Record<string, unknown>,
  flow: QuestionnaireFlowId,
  language: AppLanguage,
): OnboardingStep[] {
  return getActiveStepsForFlow(flow, data, language).filter((s) => !SKIP_STEP_TYPES.has(s.type));
}

function requiredSteps(
  data: Record<string, unknown>,
  flow: QuestionnaireFlowId,
  language: AppLanguage,
): OnboardingStep[] {
  return countableSteps(data, flow, language).filter((s) => !isOptionalStep(s));
}

export function getUnansweredRequiredStepIds(
  data: Record<string, unknown> | null | undefined,
  flow: QuestionnaireFlowId,
  language: AppLanguage = 'ar',
): string[] {
  if (!data) return [];
  return requiredSteps(data, flow, language)
    .filter((s) => !stepHasAnswer(s, data))
    .map((s) => s.id);
}

export function getFlowCompletionStats(
  data: Record<string, unknown> | null | undefined,
  flow: QuestionnaireFlowId,
  language: AppLanguage = 'ar',
): { answered: number; total: number; percent: number } {
  if (!data) return { answered: 0, total: 0, percent: 0 };

  const steps = requiredSteps(data, flow, language);
  const total = steps.length;
  if (total === 0) return { answered: 0, total: 0, percent: 0 };

  const answered = steps.filter((s) => stepHasAnswer(s, data)).length;
  return {
    answered,
    total,
    percent: Math.round((answered / total) * 100),
  };
}

/** Every required step in the flow has an answer (optional steps excluded). */
export function isFlowFullyAnswered(
  data: Record<string, unknown> | null | undefined,
  flow: QuestionnaireFlowId,
  language: AppLanguage = 'ar',
): boolean {
  const { answered, total } = getFlowCompletionStats(data, flow, language);
  return total > 0 && answered === total;
}

/** @deprecated Prefer isFlowFullyAnswered — kept for legacy call sites during migration. */
export function isFlowSubstantivelyComplete(
  data: Record<string, unknown> | null | undefined,
  flow: QuestionnaireFlowId,
  language: AppLanguage = 'ar',
): boolean {
  return isFlowFullyAnswered(data, flow, language);
}

/** Flow finished for gating / redirect — not merely "all required fields filled". */
export function isFlowCompleted(
  data: Record<string, unknown> | null | undefined,
  flow: QuestionnaireFlowId,
  language: AppLanguage = 'ar',
): boolean {
  if (!data) return false;

  const completedKey = FLOW_META[flow].completedKey;
  const progressKey = FLOW_META[flow].progressKey;
  const progressIdx = data[progressKey];

  if (data[completedKey]) return true;

  if (progressIdx === -1 && data.inProgress === false) return true;

  /** Still on the wizard — optional final steps (e.g. progress photos) must remain reachable. */
  if (data.inProgress === true) return false;

  if (isFlowFullyAnswered(data, flow, language)) return true;

  if (!data[completedKey]) return false;

  const stats = getFlowCompletionStats(data, flow, language);
  return stats.percent >= 85;
}

export function flowProgressIndex(
  data: Record<string, unknown> | null | undefined,
  flow: QuestionnaireFlowId,
): number | null {
  if (!data) return null;
  const key = FLOW_META[flow].progressKey;
  const v = data[key];
  return typeof v === 'number' ? v : null;
}

/** Core profile questionnaire finished (ignores legacy global `completedAt` from old wizard). */
export function isCoreOnboardingComplete(
  data: Record<string, unknown> | null | undefined,
  language: AppLanguage = 'ar',
): boolean {
  return isFlowCompleted(data, 'core', language);
}
