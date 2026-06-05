import { getApiBaseUrl } from './apiBaseUrl';

/** Google sign-up — passes SPA origin so OAuth callback lands on the correct dev port. */
export function getGoogleSignupUrl(): string {
  const base = getApiBaseUrl().replace(/\/$/, '');
  const origin =
    typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
  const query = origin ? `flow=signup&origin=${origin}` : 'flow=signup';
  const path = `/api/auth/google?${query}`;
  return base ? `${base}${path}` : path;
}
