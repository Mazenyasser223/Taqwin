import { useCallback, useEffect, useState } from 'react';
import gamificationService, {
  peekCompeteDashboard,
  type ChallengeParticipation,
  type LeagueStatus,
} from '../../services/gamificationService';
import { isTransientApiError } from '../../lib/apiTransientError';

export function useCompeteDashboard() {
  const initial = peekCompeteDashboard();
  const [league, setLeague] = useState<LeagueStatus | null>(initial?.league ?? null);
  const [activeChallenge, setActiveChallenge] = useState<ChallengeParticipation | null>(
    initial?.activeChallenge ?? null,
  );
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent && !peekCompeteDashboard()) setLoading(true);
    const res = await gamificationService.competeDashboard();
    if (!silent) setLoading(false);
    if (res.error) {
      if (!peekCompeteDashboard() && !initial) {
        setError(res.error);
      }
      return res.error;
    }
    setError(null);
    if (res.data?.league) setLeague(res.data.league);
    setActiveChallenge(res.data?.activeChallenge ?? null);
    return null;
  }, [initial]);

  useEffect(() => {
    void load(Boolean(initial));
  }, [load, initial]);

  useEffect(() => {
    if (!error || isTransientApiError(error)) {
      if (!error) return undefined;
      const timer = window.setInterval(() => void load(true), 5000);
      return () => window.clearInterval(timer);
    }
    return undefined;
  }, [error, load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  return { league, activeChallenge, loading, error, refresh: () => load(true) };
}
