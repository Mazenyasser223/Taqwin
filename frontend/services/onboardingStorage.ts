/**
 * Full onboarding backup: mirrors DB profile + wizard answers in localStorage
 * so refresh / brief offline does not lose progress.
 * Scoped per user id so a new account never inherits another user's wizard state.
 */
import type { Profile } from './profileService';
import authService from './authService';
import type { User } from '../types';
import type { OnboardingAnswers } from '../features/onboarding/types';

const LEGACY_BACKUP_KEY = 'taqwin_onboarding_backup';

export interface OnboardingBackup {
  userId: string;
  answers: OnboardingAnswers;
  stepIndex: number;
  profile?: Profile | null;
  updatedAt: string;
}

function backupKey(userId: string) {
  return `taqwin_onboarding_backup_${userId}`;
}

function currentUserId(): string | null {
  return authService.getStoredUser()?.id ?? null;
}

export function loadOnboardingBackup(explicitUserId?: string | null): OnboardingBackup | null {
  const userId = explicitUserId ?? currentUserId();
  if (!userId) return null;

  // Drop old global key from before per-user scoping
  try {
    localStorage.removeItem(LEGACY_BACKUP_KEY);
  } catch {
    /* ignore */
  }

  try {
    const raw = localStorage.getItem(backupKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingBackup;
    if (parsed.userId && parsed.userId !== userId) return null;
    return { ...parsed, userId };
  } catch {
    return null;
  }
}

export function saveOnboardingBackup(
  answers: OnboardingAnswers,
  stepIndex: number,
  profile?: Profile | null,
): void {
  const userId = currentUserId();
  if (!userId) return;

  const payload: OnboardingBackup = {
    userId,
    answers,
    stepIndex,
    profile: profile ?? null,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(backupKey(userId), JSON.stringify(payload));
}

export function clearOnboardingBackup(explicitUserId?: string | null): void {
  const userId = explicitUserId ?? currentUserId();
  try {
    localStorage.removeItem(LEGACY_BACKUP_KEY);
    if (userId) localStorage.removeItem(backupKey(userId));
  } catch {
    /* ignore */
  }
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

export function isOnboardingMarkedComplete(
  data: Record<string, unknown> | null | undefined,
): boolean {
  return Boolean(data?.completedAt || data?.skippedAt);
}

export function hasMeaningfulOnboardingProgress(
  data: Record<string, unknown> | null | undefined,
): boolean {
  if (!data) return false;
  if (isOnboardingMarkedComplete(data)) return true;
  if (typeof data.progressStepIndex === 'number' && data.progressStepIndex > 0) return true;
  return Object.keys(answersFromOnboardingData(data)).length > 0;
}
