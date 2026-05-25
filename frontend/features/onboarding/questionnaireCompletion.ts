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
]);

function stepHasAnswer(step: OnboardingStep, data: Record<string, unknown>): boolean {
  if (step.type === 'info' || step.type === 'hero' || step.type === 'generating' || step.type === 'summary') {
    return true;
  }
  if (step.type === 'measurements') {
    return ['measureChest', 'measureWaist', 'measureHips', 'measureArm'].some((k) => {
      const v = data[k];
      return v !== undefined && v !== null && v !== '';
    });
  }
  if (step.type === 'inbody') {
    return Boolean(data.inbodyAcknowledged || data.inbodyBodyFat || data.inbodyMuscle);
  }
  if (step.type === 'photos') {
    return Boolean(data.photoFrontDone || data.photoBackDone);
  }

  const key =
    'field' in step && typeof step.field === 'string' && step.field ? step.field : step.id;
  const v = data[key] ?? data[step.id];
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

/** User finished all visible steps but completion flag may be missing (legacy saves). */
export function isFlowSubstantivelyComplete(
  data: Record<string, unknown> | null | undefined,
  flow: QuestionnaireFlowId,
): boolean {
  if (!data) return false;

  const progressKey = FLOW_META[flow].progressKey;
  if (data[progressKey] === -1) return true;

  const steps = getActiveStepsForFlow(flow, data, 'en');
  if (steps.length === 0) return false;

  const answered = steps.filter((s) => stepHasAnswer(s, data)).length;
  const last = steps[steps.length - 1];
  if (stepHasAnswer(last, data)) return true;

  return answered / steps.length >= 0.85;
}

export function isFlowCompleted(
  data: Record<string, unknown> | null | undefined,
  flow: QuestionnaireFlowId,
): boolean {
  if (!data) return false;
  const key = FLOW_META[flow].completedKey;
  if (data[key]) return true;
  return isFlowSubstantivelyComplete(data, flow);
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
): boolean {
  return isFlowCompleted(data, 'core');
}
