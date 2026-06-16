import { useEffect, useRef } from 'react';

/** Poll only while tab is visible — for near-real-time community sync without WebSockets. */
export function useCommunityLivePoll(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
  immediate = true,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      void callbackRef.current();
    };

    if (immediate) tick();
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs, enabled, immediate]);
}

export const COMMUNITY_FEED_POLL_MS = 10_000;
export const COMMUNITY_STORIES_POLL_MS = 25_000;
export const COMMUNITY_INBOX_POLL_MS = 3_000;
export const COMMUNITY_MESSAGES_POLL_MS = 800;
export const COMMUNITY_COMMENTS_POLL_MS = 5_000;
export const COMMUNITY_PROFILE_POLL_MS = 8_000;
export const COMMUNITY_GROUPS_POLL_MS = 8_000;
export const COMMUNITY_GROUP_POSTS_POLL_MS = 10_000;
export const NOTIFICATIONS_DRAWER_POLL_MS = 5_000;
