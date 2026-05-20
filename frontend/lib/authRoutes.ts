import type { User } from '../types';
import { isSignupPendingRole } from './authStorage';
import { isOnboardingMarkedComplete } from '../services/onboardingStorage';

const META_KEYS = new Set([
  'progressStepIndex',
  'inProgress',
  'completedAt',
  'skippedAt',
  'version',
  'lastStepId',
  'savedAt',
  'roleWizard',
  'skipped',
]);

export type AuthFlow = 'login' | 'signup' | 'oauth';

export function userNeedsPassword(user: User | null | undefined): boolean {
  return Boolean(user && user.hasPassword === false);
}

/**
 * Post-auth redirect:
 * - Google / new signup without password → set password first
 * - Sign up (email or Google, after password) → onboarding
 * - Sign in → dashboard
 * - OAuth → onboarding if signup intent or onboarding not completed yet
 */
export function getPostAuthPath(
  user: User | null | undefined,
  flow: AuthFlow = 'login',
): '/dashboard' | '/onboarding' | '/auth/set-password' | '/auth' {
  if (!user) return '/onboarding';

  if (userNeedsPassword(user)) {
    return '/auth/set-password';
  }

  if (isSignupPendingRole()) {
    return '/auth';
  }

  if (flow === 'signup') {
    return '/onboarding';
  }

  if (flow === 'oauth') {
    const onboardingData = user.profile?.onboardingData as Record<string, unknown> | undefined;
    if (!isOnboardingMarkedComplete(onboardingData)) {
      return '/onboarding';
    }
    return '/dashboard';
  }

  return '/dashboard';
}

/** True when athlete still has wizard answers but no completion timestamp */
export function hasIncompleteOnboarding(user: User | null | undefined): boolean {
  if (!user || user.role !== 'athlete') return false;
  const data = user.profile?.onboardingData as Record<string, unknown> | undefined;
  if (!data?.completedAt && !data?.skippedAt) {
    const answerKeys = Object.keys(data ?? {}).filter((k) => !META_KEYS.has(k));
    return answerKeys.length > 0;
  }
  return false;
}