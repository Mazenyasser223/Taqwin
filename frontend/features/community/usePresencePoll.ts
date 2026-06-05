import { useEffect, useState } from 'react';
import communityService from '../../services/communityService';

export type PresenceMap = Record<string, { isOnline: boolean; lastSeenAt: string | null }>;

const POLL_MS = 20_000;

/** Refreshes online status for the given user ids (e.g. profile or inbox peer). */
export function usePresencePoll(userIds: string[]): PresenceMap {
  const key = [...new Set(userIds.filter(Boolean))].sort().join(',');
  const [presence, setPresence] = useState<PresenceMap>({});

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!ids.length) {
      setPresence({});
      return;
    }

    let cancelled = false;

    const load = async () => {
      const res = await communityService.getPresence(ids);
      if (!cancelled && res.data) setPresence(res.data);
    };

    void load();
    const intervalId = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [key]);

  return presence;
}
