/**
 * API base URL for fetch calls.
 * In dev, default to same-origin (Vite proxies /api → backend) so Network URLs work.
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) return '';
  return 'https://taqwin.onrender.com';
}
