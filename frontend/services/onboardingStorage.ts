/**
 * Full onboarding backup: mirrors DB profile + wizard answers in localStorage
 * so refresh / brief offline does not lose progress.
 */
import type { Profile } from './profileService';
import type { User } from '../types';
import type { OnboardingAnswers } from '../features/onboarding/types';

const BACKUP_KEY = 'taqwin_onboarding_backup';

export interface OnboardingBackup {
  answers: OnboardingAnswers;
  stepIndex: number;
  profile?: Profile | null;
  updatedAt: string;
}

export function loadOnboardingBackup(): OnboardingBackup | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OnboardingBackup;
  } catch {
    return null;
  }
}

export function saveOnboardingBackup(
  answers: OnboardingAnswers,
  stepIndex: number,
  profile?: Profile | null,
): void {
  const payload: OnboardingBackup = {
    answers,
    stepIndex,
    profile: profile ?? null,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(BACKUP_KEY, JSON.stringify(payload));
}

export function clearOnboardingBackup(): void {
  localStorage.removeItem(BACKUP_KEY);
}

/** Merge full profile (incl. onboardingData) into taqwin_user cache */
export function syncUserWithProfile(user: User, profile: Profile): User {
  const merged: User = {
    ...user,
    profile: {
      ...profile,
      onboardingData: profile.onboardingData ?? null,
    },
    name: profile.displayName ?? user.name,
    avatar: profile.avatarUrl ?? user.avatar,
  };
  localStorage.setItem('taqwin_user', JSON.stringify(merged));
  return merged;
}

const META_KEYS = new Set([
  'progressStepIndex',
  'inProgress',
  'completedAt',
  'version',
  'lastStepId',
  'savedAt',
  'roleWizard',
]);

/** Strip wizard metadata → answer map for restoring UI state */
export function answersFromOnboardingData(
  data: Record<string, unknown> | null | undefined,
): OnboardingAnswers {
  if (!data || typeof data !== 'object') return {};
  const out: OnboardingAnswers = {};
  for (const [k, v] of Object.entries(data)) {
    if (!META_KEYS.has(k)) out[k] = v as OnboardingAnswers[string];
  }
  return out;
}

export function stepIndexFromOnboardingData(
  data: Record<string, unknown> | null | undefined,
): number | null {
  if (!data || typeof data.progressStepIndex !== 'number') return null;
  return data.progressStepIndex;
}
