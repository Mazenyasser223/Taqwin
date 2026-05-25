import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useMyPresenceStore } from '../../store/useMyPresenceStore';
import communityService from '../../services/communityService';

const HEARTBEAT_MS = 30_000;

/** Keeps the signed-in user's lastSeenAt fresh while the app tab is active. */
export function usePresenceHeartbeat() {
  const userId = useAuthStore((s) => s.user?.id);
  const setActive = useMyPresenceStore((s) => s.setActive);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const ping = async () => {
      if (cancelled) return;
      if (document.hidden) {
        setActive(false);
        return;
      }
      const res = await communityService.sendPresenceHeartbeat();
      if (!cancelled && !res.error) setActive(true);
    };

    void ping();
    const intervalId = window.setInterval(() => void ping(), HEARTBEAT_MS);
    const onVisibility = () => {
      if (document.hidden) setActive(false);
      else void ping();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      setActive(false);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId, setActive]);
}
