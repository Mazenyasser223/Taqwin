import profileService, { type Profile } from '../../services/profileService';
import {
  answersFromOnboardingData,
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

/** Load answers + step from API (source of truth), then local backup */
export async function loadOnboardingState(): Promise<{
  answers: OnboardingAnswers;
  stepIndex: number;
  profile: Profile | null;
}> {
  const profileRes = await profileService.getProfile();
  const backup = loadOnboardingBackup();

  if (profileRes.data?.onboardingData) {
    const data = profileRes.data.onboardingData as Record<string, unknown>;
    const answers = answersFromOnboardingData(data);
    const idx = stepIndexFromOnboardingData(data);
    const user = authService.getStoredUser();
    if (user) syncUserWithProfile(user, profileRes.data);

    if (Object.keys(answers).length > 0 || idx !== null) {
      return {
        answers,
        stepIndex: idx ?? 0,
        profile: profileRes.data,
      };
    }
  }

  if (backup) {
    return {
      answers: backup.answers,
      stepIndex: backup.stepIndex,
      profile: backup.profile ?? profileRes.data ?? null,
    };
  }

  return { answers: {}, stepIndex: 0, profile: profileRes.data ?? null };
}
