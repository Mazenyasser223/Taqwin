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
import { useAuthStore } from '../../store/useAuthStore';
import type { OnboardingAnswers } from './types';
import { mapAnswersToProfile, mapAnswersToProgress } from './mapToProfile';
import { FLOW_META, type QuestionnaireFlowId } from './flows/types';
import {
  getFlowCompletionStats,
  isFlowFullyAnswered,
  flowProgressIndex,
  QUESTIONNAIRE_META_KEYS,
} from './questionnaireCompletion';
import type { AppLanguage } from '../../services/settingsService';

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
  /** Keep completion/progress flags unless this save explicitly replaces them. */
  const preservedMeta: Record<string, unknown> = {};
  for (const k of QUESTIONNAIRE_META_KEYS) {
    if (clean[k] !== undefined && !(k in patch)) preservedMeta[k] = clean[k];
    delete clean[k];
  }
  for (const [k, v] of Object.entries(answers)) {
    if (!QUESTIONNAIRE_META_KEYS.has(k)) clean[k] = v;
  }
  return {
    ...clean,
    questionnaireVersion: 2,
    version: 2,
    savedAt: new Date().toISOString(),
    ...preservedMeta,
    ...patch,
  };
}

function applyProfileToSession(profile: Profile) {
  const user = authService.getStoredUser();
  if (!user) return;
  const merged = syncUserWithProfile(user, profile);
  useAuthStore.getState().setUser(merged);
  if (profile.onboardingData && typeof profile.onboardingData === 'object') {
    lastKnownOnboardingData = profile.onboardingData as Record<string, unknown>;
  }
}

let lastKnownOnboardingData: Record<string, unknown> | undefined;

function resolveExistingOnboardingData(): Record<string, unknown> | undefined {
  if (lastKnownOnboardingData) return lastKnownOnboardingData;
  const backup = loadOnboardingBackup();
  if (backup?.profile?.onboardingData && typeof backup.profile.onboardingData === 'object') {
    lastKnownOnboardingData = backup.profile.onboardingData as Record<string, unknown>;
    return lastKnownOnboardingData;
  }
  const user = useAuthStore.getState().user;
  if (user?.profile?.onboardingData && typeof user.profile.onboardingData === 'object') {
    lastKnownOnboardingData = user.profile.onboardingData as Record<string, unknown>;
    return lastKnownOnboardingData;
  }
  return undefined;
}

async function fetchExistingOnboardingData(): Promise<Record<string, unknown> | undefined> {
  const cached = resolveExistingOnboardingData();
  if (cached) return cached;
  const profileRes = await profileService.getProfile();
  const existing = profileRes.data?.onboardingData as Record<string, unknown> | undefined;
  if (existing) lastKnownOnboardingData = existing;
  return existing;
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
    applyProfileToSession(profile);
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
    if (profile?.onboardingData && typeof profile.onboardingData === 'object') {
      lastKnownOnboardingData = profile.onboardingData as Record<string, unknown>;
    }
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

export async function persistDossierFieldUpdate(
  flow: QuestionnaireFlowId,
  answers: OnboardingAnswers,
  stepId: string,
): Promise<PersistResult> {
  const existing = await fetchExistingOnboardingData();
  const stepIndex = Math.max(0, flowProgressIndex(existing, flow) ?? 0);

  const next: OnboardingAnswers = { ...answers };
  if (Array.isArray(next.skippedSteps)) {
    const filtered = (next.skippedSteps as string[]).filter((id) => id !== stepId);
    if (filtered.length > 0) next.skippedSteps = filtered;
    else delete next.skippedSteps;
  }

  return persistQuestionnaireProgress(flow, next, stepIndex, stepId);
}

export async function persistQuestionnaireProgress(
  flow: QuestionnaireFlowId,
  answers: OnboardingAnswers,
  stepIndex: number,
  lastStepId?: string,
): Promise<PersistResult> {
  const existing = await fetchExistingOnboardingData();
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
    applyProfileToSession(result.data);
  }
  return { ok: true, profile: result.data };
}

export async function persistQuestionnaireComplete(
  flow: QuestionnaireFlowId,
  answers: OnboardingAnswers,
  language: AppLanguage = 'ar',
): Promise<PersistResult> {
  const existing = await fetchExistingOnboardingData();
  const payload = mapAnswersToProfile(answers);
  const completedKey = FLOW_META[flow].completedKey;
  const progressKey = FLOW_META[flow].progressKey;

  const draftData = mergeOnboardingPayload(answers, existing, payload.onboardingData ?? {});
  if (!isFlowFullyAnswered(draftData, flow, language)) {
    return { ok: false, error: 'Questionnaire incomplete' };
  }

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
    applyProfileToSession(result.data);
  }
  return { ok: true, profile: result.data };
}

/** Save partial progress and clear any erroneous completion flag (skip / exit early). */
export async function persistQuestionnaireAbandoned(
  flow: QuestionnaireFlowId,
  answers: OnboardingAnswers,
  stepIndex: number,
  lastStepId?: string,
): Promise<PersistResult> {
  const existing = await fetchExistingOnboardingData();
  const partial = mapAnswersToProgress(answers, stepIndex, lastStepId);
  const completedKey = FLOW_META[flow].completedKey;
  const progressKey = FLOW_META[flow].progressKey;

  const onboardingData = mergeOnboardingPayload(answers, existing, {
    ...partial.onboardingData,
    [progressKey]: stepIndex,
    inProgress: true,
    lastStepId,
  });
  delete onboardingData[completedKey];

  const result = await profileService.updateProfile({
    ...partial,
    onboardingData,
  });
  if (result.error) {
    saveOnboardingBackup(answers, stepIndex);
    return { ok: false, error: result.error };
  }
  if (result.data) {
    saveOnboardingBackup(answers, stepIndex, result.data);
    applyProfileToSession(result.data);
  }
  return { ok: true, profile: result.data };
}

/** Backfill completion timestamp when every step is answered but meta was wiped. */
export async function repairFlowCompletionFlag(
  flow: QuestionnaireFlowId,
  language: AppLanguage = 'ar',
): Promise<void> {
  const profileRes = await profileService.getProfile();
  const existing = profileRes.data?.onboardingData as Record<string, unknown> | undefined;
  if (!existing) return;

  const completedKey = FLOW_META[flow].completedKey;
  if (existing[completedKey]) return;
  const stats = getFlowCompletionStats(existing, flow, language);
  if (!isFlowFullyAnswered(existing, flow, language) && stats.percent < 85) return;

  const progressKey = FLOW_META[flow].progressKey;
  const result = await profileService.updateProfile({
    onboardingData: mergeOnboardingPayload({}, existing, {
      [completedKey]: new Date().toISOString(),
      [progressKey]: -1,
      inProgress: false,
    }),
  });
  if (result.data) applyProfileToSession(result.data);
}

/** Remove completion flag when user skipped or only partially answered (legacy bad saves). */
export async function repairStaleFlowCompletionFlag(
  flow: QuestionnaireFlowId,
  language: AppLanguage = 'ar',
): Promise<void> {
  const profileRes = await profileService.getProfile();
  const existing = profileRes.data?.onboardingData as Record<string, unknown> | undefined;
  if (!existing) return;

  const completedKey = FLOW_META[flow].completedKey;
  const progressKey = FLOW_META[flow].progressKey;
  if (!existing[completedKey]) return;
  const stats = getFlowCompletionStats(existing, flow, language);
  if (stats.percent >= 85 || isFlowFullyAnswered(existing, flow, language)) return;

  const onboardingData = mergeOnboardingPayload({}, existing, { inProgress: true });
  delete onboardingData[completedKey];
  if (onboardingData[progressKey] === -1) {
    onboardingData[progressKey] = Math.max(0, flowProgressIndex(existing, flow) ?? 0);
  }

  const result = await profileService.updateProfile({ onboardingData });
  if (result.data) applyProfileToSession(result.data);
}
