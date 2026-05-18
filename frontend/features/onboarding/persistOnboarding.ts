import profileService, { type Profile } from '../../services/profileService';
import {
  answersFromOnboardingData,
  clearOnboardingBackup,
  hasMeaningfulOnboardingProgress,
  isOnboardingMarkedComplete,
  loadOnboardingBackup,
  saveOnboardingBackup,
  stepIndexFromOnboardingData,
  syncUserWithProfile,
} from '../../services/onboardingStorage';
import authService from '../../services/authService';
import type { OnboardingAnswers } from './types';
import { mapAnswersToProfile, mapAnswersToProgress } from './mapToProfile';

export interface PersistResult {
  ok: boolean;
  error?: string;
  profile?: Profile;
}

/** Save full wizard state to DB + local backup */
export async function persistOnboardingProgress(
  answers: OnboardingAnswers,
  stepIndex: number,
  lastStepId?: string,
): Promise<PersistResult> {
  const payload = mapAnswersToProgress(answers, stepIndex, lastStepId);
  const result = await profileService.updateProfile(payload);

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

/** Final save when wizard completes */
export async function persistOnboardingComplete(
  answers: OnboardingAnswers,
): Promise<PersistResult> {
  const payload = mapAnswersToProfile(answers);
  payload.onboardingData = {
    ...payload.onboardingData,
    inProgress: false,
    completedAt: new Date().toISOString(),
  };

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

/** Load answers + step from API (source of truth), then per-user local backup */
export async function loadOnboardingState(): Promise<{
  answers: OnboardingAnswers;
  stepIndex: number;
  profile: Profile | null;
}> {
  const userId = authService.getStoredUser()?.id ?? null;
  const profileRes = await profileService.getProfile();
  const profile = profileRes.data ?? null;
  const onboardingData = profile?.onboardingData as Record<string, unknown> | undefined;

  if (userId) {
    const user = authService.getStoredUser();
    if (user && profile) syncUserWithProfile(user, profile);
  }

  // Resume only when this account already has saved wizard progress on the server
  if (profile && hasMeaningfulOnboardingProgress(onboardingData)) {
    const answers = answersFromOnboardingData(onboardingData);
    const idx = stepIndexFromOnboardingData(onboardingData);
    return {
      answers,
      stepIndex: isOnboardingMarkedComplete(onboardingData) ? 0 : (idx ?? 0),
      profile,
    };
  }

  const backup = loadOnboardingBackup(userId);
  if (
    userId &&
    backup?.userId === userId &&
    backup.stepIndex >= 0 &&
    Object.keys(backup.answers).length > 0
  ) {
    return {
      answers: backup.answers,
      stepIndex: Math.max(0, backup.stepIndex),
      profile: backup.profile ?? profile,
    };
  }

  // Brand-new account: always start from step 0 (Strength program intro)
  clearOnboardingBackup(userId ?? undefined);
  return { answers: {}, stepIndex: 0, profile };
}
