import type { User } from '../types';

const META_KEYS = new Set([
  'progressStepIndex',
  'inProgress',
  'completedAt',
  'version',
  'lastStepId',
  'savedAt',
  'roleWizard',
  'skipped',
]);

export type AuthFlow = 'login' | 'signup' | 'oauth';

/**
 * Post-auth redirect:
 * - Sign up → onboarding (first-time setup)
 * - Sign in / OAuth → dashboard (home); onboarding is not forced on return visits
 */
export function getPostAuthPath(
  user: User | null | undefined,
  flow: AuthFlow = 'login',
): '/dashboard' | '/onboarding' {
  if (!user) return '/onboarding';

  if (flow === 'signup') {
    return '/onboarding';
  }

  // Login & OAuth: home page
  return '/dashboard';
}

/** True when athlete still has wizard answers but no completion timestamp */
export function hasIncompleteOnboarding(user: User | null | undefined): boolean {
  if (!user || user.role !== 'athlete') return false;
  const data = user.profile?.onboardingData as Record<string, unknown> | undefined;
  if (!data?.completedAt) {
    const answerKeys = Object.keys(data ?? {}).filter((k) => !META_KEYS.has(k));
    return answerKeys.length > 0;
  }
  return false;
}