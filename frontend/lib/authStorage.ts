/**
 * Auth session persistence — "Remember me" uses localStorage (survives browser restart).
 * Otherwise sessionStorage (cleared when the tab/browser session ends).
 * Never stores passwords — only token, user snapshot, and optional saved email.
 */
import type { User } from '../types';

const REMEMBER_KEY = 'taqwin_remember_me';
const SAVED_EMAIL_KEY = 'taqwin_saved_email';
const TOKEN_KEY = 'taqwin_token';
const USER_KEY = 'taqwin_user';
/** Google sign-up: role is chosen after password, like email sign-up */
const PENDING_ROLE_KEY = 'taqwin_signup_pending_role';

export function setSignupPendingRole(pending: boolean): void {
  if (typeof window === 'undefined') return;
  if (pending) sessionStorage.setItem(PENDING_ROLE_KEY, '1');
  else sessionStorage.removeItem(PENDING_ROLE_KEY);
}

export function isSignupPendingRole(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(PENDING_ROLE_KEY) === '1';
}

export function isRememberMeEnabled(): boolean {
  const v = localStorage.getItem(REMEMBER_KEY);
  if (v === null) return true;
  return v === '1';
}

export function setRememberMePreference(enabled: boolean, email?: string): void {
  if (enabled) {
    localStorage.setItem(REMEMBER_KEY, '1');
    if (email?.trim()) {
      localStorage.setItem(SAVED_EMAIL_KEY, email.trim().toLowerCase());
    }
  } else {
    localStorage.setItem(REMEMBER_KEY, '0');
    localStorage.removeItem(SAVED_EMAIL_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

export function getSavedEmail(): string | null {
  if (!isRememberMeEnabled()) return null;
  return localStorage.getItem(SAVED_EMAIL_KEY);
}

function activeStorage(): Storage {
  return isRememberMeEnabled() ? localStorage : sessionStorage;
}

export function persistAuthSession(token: string, user: User, rememberMe: boolean): void {
  setRememberMePreference(rememberMe, user.email);
  const storage = rememberMe ? localStorage : sessionStorage;
  const other = rememberMe ? sessionStorage : localStorage;

  storage.setItem(TOKEN_KEY, token);
  storage.setItem(USER_KEY, JSON.stringify(user));

  other.removeItem(TOKEN_KEY);
  other.removeItem(USER_KEY);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function getAuthUser(): User | null {
  const raw =
    localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function syncAuthUser(user: User): void {
  const storage = activeStorage();
  storage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
  }
}
