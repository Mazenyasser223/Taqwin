import profileService, { type Profile } from '../../services/profileService';
import {
  answersFromOnboardingData,
  clearOnboardingBackup,
  loadOnboardingBackup,
  saveOnboardingBackup,
  stepIndexFromOnboardingData,
  syncUserWithProfile,
} from '../../services/onboardingStorage';
import authService from '../../services/authService';
import type { OnboardingAnswers } from './types';
import { mapAnswersToProfile, mapAnswersToProgress } from './mapToProfile';
import { FLOW_META, type QuestionnaireFlowId } from './flows/types';
import { QUESTIONNAIRE_META_KEYS } from './questionnaireCompletion';

export interface PersistResult {
  ok: boolean;
  error?: string;
  profile?: Profile;
}

function mergeOnboardingPayload(
  answers: OnboardingAnswers,
  existing: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = { ...(existing ?? {}) };
  for (const k of QUESTIONNAIRE_META_KEYS) delete clean[k];
  for (const [k, v] of Object.entries(answers)) {
    if (!QUESTIONNAIRE_META_KEYS.has(k)) clean[k] = v;
  }
  return {
    ...clean,
    questionnaireVersion: 2,
    version: 2,
    savedAt: new Date().toISOString(),
    ...patch,
  };
}

export async function loadQuestionnaireState(flow: QuestionnaireFlowId): Promise<{
  answers: OnboardingAnswers;
  stepIndex: number;
  profile: Profile | null;
}> {
  const userId = authService.getStoredUser()?.id ?? null;
  const profileRes = await profileService.getProfile();
  const profile = profileRes.data ?? null;
  const onboardingData = profile?.onboardingData as Record<string, unknown> | undefined;

  if (userId && profile) {
    const user = authService.getStoredUser();
    if (user) syncUserWithProfile(user, profile);
  }

  const answers = answersFromOnboardingData(onboardingData);
  const progressKey = FLOW_META[flow].progressKey;
  const idx =
    typeof onboardingData?.[progressKey] === 'number'
      ? (onboardingData[progressKey] as number)
      : flow === 'core'
        ? stepIndexFromOnboardingData(onboardingData)
        : null;

  if (Object.keys(answers).length > 0 || idx !== null) {
    return {
      answers,
      stepIndex: Math.max(0, idx ?? 0),
      profile,
    };
  }

  const backup = loadOnboardingBackup(userId);
  if (backup?.userId === userId && Object.keys(backup.answers).length > 0) {
    return {
      answers: backup.answers,
      stepIndex: Math.max(0, backup.stepIndex),
      profile: backup.profile ?? profile,
    };
  }

  return { answers: {}, stepIndex: 0, profile };
}

export async function persistQuestionnaireProgress(
  flow: QuestionnaireFlowId,
  answers: OnboardingAnswers,
  stepIndex: number,
  lastStepId?: string,
): Promise<PersistResult> {
  const profileRes = await profileService.getProfile();
  const existing = profileRes.data?.onboardingData as Record<string, unknown> | undefined;
  const partial = mapAnswersToProgress(answers, stepIndex, lastStepId);
  const progressKey = FLOW_META[flow].progressKey;
  partial.onboardingData = mergeOnboardingPayload(answers, existing, {
    ...partial.onboardingData,
    [progressKey]: stepIndex,
    inProgress: true,
    lastStepId,
  });

  const result = await profileService.updateProfile(partial);
  if (result.error) {
    saveOnboardingBackup(answers, stepIndex);
    return { ok: false, error: result.error };
  }
  if (result.data) {
    saveOnboardingBackup(answers, stepIndex, result.data);
    const user = authService.getStoredUser();
    if (user) syncUserWithProfile(user, result.data);
  }
  return { ok: true, profile: result.data };
}

export async function persistQuestionnaireComplete(
  flow: QuestionnaireFlowId,
  answers: OnboardingAnswers,
): Promise<PersistResult> {
  const profileRes = await profileService.getProfile();
  const existing = profileRes.data?.onboardingData as Record<string, unknown> | undefined;
  const payload = mapAnswersToProfile(answers);
  const completedKey = FLOW_META[flow].completedKey;
  const progressKey = FLOW_META[flow].progressKey;

  payload.onboardingData = mergeOnboardingPayload(answers, existing, {
    ...payload.onboardingData,
    [completedKey]: new Date().toISOString(),
    [progressKey]: -1,
    inProgress: false,
    ...(flow === 'core' ? { completedAt: new Date().toISOString() } : {}),
  });

  const result = await profileService.updateProfile(payload);
  if (result.error) {
    saveOnboardingBackup(answers, -1);
    return { ok: false, error: result.error };
  }
  if (result.data) {
    saveOnboardingBackup(answers, -1, result.data);
    const user = authService.getStoredUser();
    if (user) syncUserWithProfile(user, result.data);
  }
  return { ok: true, profile: result.data };
}
