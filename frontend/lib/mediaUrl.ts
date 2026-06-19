import { getApiBaseUrl } from './apiBaseUrl';

const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

function apiOriginForMedia(): string | null {
  const apiBase = getApiBaseUrl().replace(/\/$/, '');
  if (!apiBase) return null;
  try {
    return new URL(apiBase).origin;
  } catch {
    return null;
  }
}

/**
 * Normalize upload/media URLs:
 * - Dev: relative /uploads/... (Vite proxies to backend)
 * - Production SPA: absolute https://api.../uploads/... (API host serves files)
 * - Supabase / external URLs: unchanged
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url?.trim()) return '';
  const trimmed = url.trim();

  const apiOrigin = apiOriginForMedia();

  if (trimmed.startsWith('/uploads/')) {
    if (import.meta.env.DEV || !apiOrigin) return trimmed;
    return `${apiOrigin}${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);

    if (!parsed.pathname.startsWith('/uploads/')) {
      return trimmed;
    }

    if (import.meta.env.DEV) {
      return parsed.pathname;
    }

    if (apiOrigin) {
      if (parsed.origin === apiOrigin || LOCAL_DEV_ORIGIN.test(parsed.origin)) {
        return `${apiOrigin}${parsed.pathname}${parsed.search}`;
      }
    }
  } catch {
    /* not an absolute URL */
  }

  return trimmed;
}
