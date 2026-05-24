import { useEffect, useRef } from 'react';

/** Poll only while tab is visible — for near-real-time community sync without WebSockets. */
export function useCommunityLivePoll(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      void callbackRef.current();
    };

    tick();
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs, enabled]);
}

export const COMMUNITY_FEED_POLL_MS = 20_000;
export const COMMUNITY_STORIES_POLL_MS = 15_000;
export const COMMUNITY_INBOX_POLL_MS = 4_000;
export const COMMUNITY_MESSAGES_POLL_MS = 2_000;
export const COMMUNITY_COMMENTS_POLL_MS = 12_000;
export const COMMUNITY_NOTIFICATIONS_POLL_MS = 15_000;
export const NOTIFICATIONS_DRAWER_POLL_MS = 5_000;
