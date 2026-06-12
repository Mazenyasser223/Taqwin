import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useMyPresenceStore } from '../../store/useMyPresenceStore';
import communityService from '../../services/communityService';
import { useRealtimeStore, isRealtimeOpen } from '../../lib/realtime/useRealtimeStore';

const HEARTBEAT_MS = 30_000;

/** Keeps presence fresh via WebSocket when connected, else REST heartbeat. */
export function usePresenceHeartbeat() {
  const userId = useAuthStore((s) => s.user?.id);
  const setActive = useMyPresenceStore((s) => s.setActive);
  const send = useRealtimeStore((s) => s.send);
  const connectionState = useRealtimeStore((s) => s.connectionState);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const pingRest = async () => {
      if (cancelled || document.hidden) {
        setActive(false);
        return;
      }
      const res = await communityService.sendPresenceHeartbeat();
      if (!cancelled && !res.error) setActive(true);
    };

    const ping = () => {
      if (document.hidden) {
        setActive(false);
        return;
      }
      if (isRealtimeOpen()) {
        send({ type: 'presence.ping' });
        setActive(true);
      } else {
        void pingRest();
      }
    };

    ping();
    const intervalId = window.setInterval(ping, HEARTBEAT_MS);
    const onVisibility = () => {
      if (document.hidden) setActive(false);
      else ping();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      setActive(false);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId, setActive, send, connectionState]);
}
