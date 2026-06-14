import type { AppLanguage } from '../../services/settingsService';
import { getActiveStepsForFlow } from './flows';
import { FEMALE_HEALTH_STEP_IDS } from './flows/femaleHealthSteps';
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

const FEMALE_HEALTH_OPTIONAL = new Set<string>(FEMALE_HEALTH_STEP_IDS);

function isOptionalStep(step: OnboardingStep): boolean {
  if (FEMALE_HEALTH_OPTIONAL.has(step.id)) return true;
  if ('optional' in step && step.optional === true) return true;
  if (step.id === 'targetWeight') return true;
  if (step.type === 'measurements') return true;
  /** InBody fields are optional — user confirms or skips the step entirely. */
  if (step.id === 'inbodyScan' || step.type === 'inbody') return true;
  if (step.type === 'photos') return true;
  return false;
}

function isStepSkipped(step: OnboardingStep, data: Record<string, unknown>): boolean {
  const skipped = data.skippedSteps;
  return Array.isArray(skipped) && skipped.includes(step.id);
}

export { isStepSkipped };

/** Whether the user may leave this step (Continue / forward chevron). */
export function canProceedFromStep(step: OnboardingStep, data: Record<string, unknown>): boolean {
  if (isOptionalStep(step) || isStepSkipped(step, data)) return true;
  return stepHasAnswer(step, data);
}

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
      data.inbodyAcknowledged ||
        data.inbodyBodyMetricId ||
        data.inbodyReportUrl ||
        data.inbodyData ||
        data.inbodyBodyFat ||
        data.inbodyMuscle ||
        data.inbodyBmr,
    );
  }
  if (step.type === 'photos') {
    if (isOptionalStep(step)) return true;
    return Boolean(
      (typeof data.photoFrontUrl === 'string' && data.photoFrontUrl) ||
        (typeof data.photoSideUrl === 'string' && data.photoSideUrl) ||
        (typeof data.photoBackUrl === 'string' && data.photoBackUrl) ||
        data.photoFrontDone ||
        data.photoSideDone ||
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
  if (step.id === 'upcomingEvent' && data.upcomingEvent === 'other') {
    const detail = data.upcomingEventOther;
    if (typeof detail !== 'string' || !detail.trim()) return false;
  }
  if (step.id === 'dietType' && data.dietType === 'other') {
    const detail = data.dietTypeOther;
    if (typeof detail !== 'string' || !detail.trim()) return false;
  }
  if (step.id === 'trainingObstacle' && Array.isArray(data.trainingObstacle) && (data.trainingObstacle as string[]).includes('other')) {
    const detail = data.trainingObstacleOther;
    if (typeof detail !== 'string' || !detail.trim()) return false;
  }
  if (step.id === 'restDaysPreference' && data.restDaysPreference === 'fixed') {
    const needed = 7 - (Number(String(data.trainingDaysPerWeek ?? '').match(/(\d+)/)?.[1]) || 4);
    const days = data.fixedRestDays;
    if (!Array.isArray(days) || days.length !== needed) return false;
  }
  if (step.id === 'injuries' && Array.isArray(data.injuries) && (data.injuries as string[]).includes('other')) {
    const detail = data.injuriesOther;
    if (typeof detail !== 'string' || !detail.trim()) return false;
  }
  if (
    step.id === 'upcomingEvent' &&
    data.upcomingEvent &&
    data.upcomingEvent !== 'none'
  ) {
    const date = data.upcomingEventDate;
    if (typeof date !== 'string' || !date.trim()) return false;
  }
  if (step.id === 'planFailed') {
    if (data.planFailed === 'no') return true;
    const reasons = data.planFailedReasons;
    if (!Array.isArray(reasons) || reasons.length === 0) return false;
    if (reasons.includes('other')) {
      const other = data.planFailedOther;
      if (typeof other !== 'string' || !other.trim()) return false;
    }
    return true;
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

/** True while the user is mid-wizard (must not redirect to dashboard). */
export function isQuestionnaireInProgress(
  data: Record<string, unknown> | null | undefined,
  flow: QuestionnaireFlowId,
): boolean {
  if (!data) return false;
  if (data.inProgress === true) return true;
  const completedKey = FLOW_META[flow].completedKey;
  if (data[completedKey]) return false;
  const progressKey = FLOW_META[flow].progressKey;
  const progressIdx = data[progressKey];
  return typeof progressIdx === 'number' && progressIdx >= 0;
}

/** Flow finished for gating / redirect — explicit completion only, not "all fields filled". */
export function isFlowCompleted(
  data: Record<string, unknown> | null | undefined,
  flow: QuestionnaireFlowId,
  _language: AppLanguage = 'ar',
): boolean {
  if (!data) return false;

  const completedKey = FLOW_META[flow].completedKey;
  const progressKey = FLOW_META[flow].progressKey;
  const progressIdx = data[progressKey];

  /** Still answering — never treat as finished (even if legacy flags exist). */
  if (isQuestionnaireInProgress(data, flow)) return false;

  if (data[completedKey]) return true;

  /** Legacy single-wizard athletes (pre multi-flow questionnaires). */
  if (flow === 'core' && data.completedAt && data.inProgress === false) {
    const legacyProgress = data.progressStepIndex;
    if (legacyProgress === -1 || progressIdx === -1) return true;
  }

  return false;
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

/** All four athlete questionnaires done (triggers Block C4 plan generation). */
export function isOfficialOnboardingComplete(
  data: Record<string, unknown> | null | undefined,
): boolean {
  if (!data) return false;
  return Boolean(
    data.coreCompletedAt &&
      data.workoutPlanCompletedAt &&
      data.dietPlanCompletedAt &&
      data.wellnessCompletedAt
  );
}
