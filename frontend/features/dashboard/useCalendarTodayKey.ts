import { useEffect, useState } from 'react';
import { getClientTodayKey } from './weekPlanNavigation';

/** Keeps "today" in sync with the device clock (midnight rollover, tab focus). */
export function useCalendarTodayKey(apiToday?: string): string {
  const [clientToday, setClientToday] = useState(getClientTodayKey);

  useEffect(() => {
    const refresh = () => setClientToday(getClientTodayKey());
    refresh();
    const interval = window.setInterval(refresh, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!apiToday) return clientToday;
  return clientToday > apiToday ? clientToday : apiToday;
}
