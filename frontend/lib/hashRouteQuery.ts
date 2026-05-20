/**
 * HashRouter puts the route in location.hash (#/auth?error=...).
 * useSearchParams() can miss query params on a full-page OAuth redirect — read the hash directly.
 */
export function getHashQueryParams(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  const hash = window.location.hash;
  const queryStart = hash.indexOf('?');
  if (queryStart === -1) return new URLSearchParams();
  return new URLSearchParams(hash.slice(queryStart + 1));
}

export function getAuthRedirectParams(searchParams: URLSearchParams): URLSearchParams {
  const hashParams = getHashQueryParams();
  const merged = new URLSearchParams();
  for (const [key, value] of hashParams.entries()) merged.set(key, value);
  for (const [key, value] of searchParams.entries()) {
    if (!merged.has(key)) merged.set(key, value);
  }
  return merged;
}

/** OAuth / auth errors returned from the backend after Google sign-up */
export function isAuthOAuthError(code: string | null): boolean {
  return code === 'account_exists' || code === 'google_signup_only' || code === 'oauth_failed';
}

export function replaceHashPath(pathname: string): void {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const hash = `#${path}`;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
}
