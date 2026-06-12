/**
 * API base URL for fetch calls.
 * In dev, default to same-origin (Vite proxies /api → backend) so Network URLs work.
 */
function isLocalBrowserHost(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname, port } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (/^192\.168\./.test(hostname) || /^10\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  // Vite dev / preview ports used locally
  return port === '3000' || port === '4173' || port === '5173';
}

export function getApiBaseUrl(): string {
  // Dev: always same-origin — Vite proxies /api → backend (never call api.taqwin.com etc. from browser).
  if (import.meta.env.DEV) return '';

  const fromEnv = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');

  // Local preview / LAN: same-origin + Vite preview proxy — ignore production VITE_API_URL.
  if (isLocalBrowserHost()) return '';

  if (fromEnv) return fromEnv;

  return 'https://taqwin.onrender.com';
}
