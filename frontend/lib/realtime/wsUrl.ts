/**
 * WebSocket URL for Taqwin realtime hub (same host as API in dev via Vite proxy).
 */
export function getWsUrl(): string {
  if (typeof window === 'undefined') return '';

  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  if (import.meta.env.DEV) {
    return `${wsProto}//${window.location.host}/ws`;
  }

  const fromEnv = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '');
  if (fromEnv) {
    try {
      const parsed = new URL(fromEnv);
      const hostProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${hostProto}//${parsed.host}/ws`;
    } catch {
      /* fall through */
    }
  }

  return `${wsProto}//${window.location.host}/ws`;
}
