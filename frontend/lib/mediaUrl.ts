import { getApiBaseUrl } from './apiBaseUrl';

const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

/** Resolve stored upload URLs for the current environment (fixes localhost URLs in production). */
export function resolveMediaUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  let out = url.trim();
  if (!out) return null;

  const base = getApiBaseUrl().replace(/\/$/, '') || 'https://taqwin.onrender.com';

  if (out.startsWith('/uploads/')) {
    out = `${base}${out}`;
  }

  if (LOCAL_DEV_ORIGIN.test(out)) {
    out = out.replace(LOCAL_DEV_ORIGIN, base);
  }

  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && out.startsWith('http://')) {
    out = out.replace(/^http:\/\//i, 'https://');
  }

  return out;
}
