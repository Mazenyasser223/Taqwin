import { FLOW_META, type QuestionnaireFlowId } from './flows/types';

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

export function isFlowCompleted(
  data: Record<string, unknown> | null | undefined,
  flow: QuestionnaireFlowId,
): boolean {
  if (!data) return false;
  const key = FLOW_META[flow].completedKey;
  return Boolean(data[key]);
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

export function isCoreOnboardingComplete(
  data: Record<string, unknown> | null | undefined,
): boolean {
  return isFlowCompleted(data, 'core') || Boolean(data?.completedAt);
}
