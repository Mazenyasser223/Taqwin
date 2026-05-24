import { getApiBaseUrl } from './apiBaseUrl';

/**
 * Normalize upload/media URLs so they load in dev (Vite proxies /uploads → backend).
 * Rewrites http://localhost:4000/uploads/... to /uploads/... on the same origin.
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url?.trim()) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('/uploads/')) return trimmed;

  try {
    const parsed = new URL(trimmed);
    if (!parsed.pathname.startsWith('/uploads/')) return trimmed;

    if (import.meta.env.DEV) return parsed.pathname;

    const apiBase = getApiBaseUrl().replace(/\/$/, '');
    if (apiBase) {
      try {
        const apiOrigin = new URL(apiBase).origin;
        if (parsed.origin === apiOrigin) return parsed.pathname;
      } catch {
        /* apiBase may be empty in dev */
      }
    }
  } catch {
    /* not an absolute URL */
  }

  return trimmed;
}
