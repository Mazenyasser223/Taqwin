import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import gamificationService, {
  type LeaderboardEntry,
  type LeaderboardScope,
  type LeagueStatus,
} from '../../services/gamificationService';
import { CompetePageShell } from './CompetePageShell';
import { CompeteCardSkeleton } from './CompeteDashboardCardShell';
import { LeaguePodHero } from './LeaguePodHero';
import { LeaguePodium } from './LeaguePodium';
import { LeagueLeaderboardChart } from './LeagueLeaderboardChart';
import { LeaderboardRow, LeaderboardSkeleton } from './LeaderboardRow';
import { LeagueScopeTabs } from './LeagueScopeTabs';
import { LeagueJoinHero } from './LeagueJoinHero';
import { COMPETE_KPI_THEMES } from './competeDashboardStyles';
import { invalidateCompeteDashboardCache } from '../../services/gamificationService';
import { leaderScore, listEntriesAfterPodium, promotionCutoffRank } from './competeLeagueUtils';

const CARD =
  'rounded-xl border border-gray-200/80 bg-white/90 shadow-sm dark:border-gray-800 dark:bg-[#0c1220]/90';

const PREFETCH_SCOPES: LeaderboardScope[] = ['friends', 'gym', 'global'];

export const CompeteLeaguePage: React.FC = () => {
  const { t } = useI18n();
  const theme = COMPETE_KPI_THEMES.league;
  const [league, setLeague] = useState<LeagueStatus | null>(null);
  const [scope, setScope] = useState<LeaderboardScope>('league');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scopeCache = useRef<Partial<Record<LeaderboardScope, LeaderboardEntry[]>>>({});
  const boardRequestId = useRef(0);
  const initialLoadDone = useRef(false);

  const applyBoard = useCallback((nextScope: LeaderboardScope, nextEntries: LeaderboardEntry[]) => {
    scopeCache.current[nextScope] = nextEntries;
    setEntries(nextEntries);
  }, []);

  const loadBoard = useCallback(
    async (nextScope: LeaderboardScope) => {
      const cached = scopeCache.current[nextScope];
      if (cached) {
        setEntries(cached);
        return;
      }

      const reqId = ++boardRequestId.current;
      setBoardLoading(true);

      const boardRes = await gamificationService.leaderboard(nextScope);
      if (reqId !== boardRequestId.current) return;

      setBoardLoading(false);
      if (boardRes.error) {
        setError(boardRes.error);
        return;
      }
      applyBoard(nextScope, boardRes.data?.entries ?? []);
    },
    [applyBoard],
  );

  const prefetchOtherScopes = useCallback(async () => {
    await Promise.all(
      PREFETCH_SCOPES.map(async (s) => {
        if (scopeCache.current[s]) return;
        const res = await gamificationService.leaderboard(s);
        if (!res.error && res.data?.entries) {
          scopeCache.current[s] = res.data.entries;
        }
      }),
    );
  }, []);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    void (async () => {
      setError(null);
      const statusRes = await gamificationService.leagueCurrent({ light: true });
      if (statusRes.error) {
        setError(statusRes.error);
        setStatusLoading(false);
        return;
      }

      const status = statusRes.data ?? { optedIn: false };
      setLeague(status);
      setStatusLoading(false);

      if (!status.optedIn) return;

      await loadBoard('league');
      window.setTimeout(() => void prefetchOtherScopes(), 200);
    })();
  }, [loadBoard, prefetchOtherScopes]);

  useEffect(() => {
    if (statusLoading || !league?.optedIn) return;
    void loadBoard(scope);
  }, [league?.optedIn, loadBoard, scope, statusLoading]);

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    const res = await gamificationService.joinLeague();
    setJoining(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    scopeCache.current = {};
    if (res.data?.league) {
      setLeague(res.data.league);
      invalidateCompeteDashboardCache();
      if (res.data.league.optedIn) {
        await loadBoard('league');
        window.setTimeout(() => void prefetchOtherScopes(), 200);
      }
    }
  };

  const topScore = useMemo(() => leaderScore(entries), [entries]);
  const promotionRank = useMemo(
    () => (scope === 'league' ? promotionCutoffRank(entries.length) : 0),
    [entries.length, scope],
  );
  const listEntries = useMemo(() => listEntriesAfterPodium(entries), [entries]);
  const showPodium = scope === 'league' && entries.some((e) => e.rank != null && e.rank <= 3);
  const showEmptyBoard = entries.length === 0 && !boardLoading;

  return (
    <CompetePageShell
      title={t('compete.leagueTitle')}
      subtitle={t('compete.leagueSubtitle')}
      action={
        <Link
          to="/compete/challenges"
          className="inline-flex items-center gap-1 rounded-xl border border-gray-200/90 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:bg-white dark:border-white/12 dark:bg-white/[0.06] dark:text-gray-200 sm:text-xs"
        >
          <span className="material-symbols-outlined text-[16px]">flag</span>
          {t('compete.challengesTitle')}
        </Link>
      }
    >
      {error ? (
        <div className={cn(CARD, 'mb-4 border-error-500/30 bg-error-500/5 p-4 text-sm text-error-600')}>
          {error}
        </div>
      ) : null}

      {statusLoading ? (
        <CompeteCardSkeleton theme="league" />
      ) : !league?.optedIn ? (
        <LeagueJoinHero joining={joining} onJoin={() => void handleJoin()} />
      ) : (
        <>
          <LeaguePodHero league={league} />
          <LeagueScopeTabs scope={scope} onChange={setScope} />

          {boardLoading && entries.length === 0 ? (
            <div
              className={cn(
                'overflow-hidden rounded-2xl border',
                'border-gray-200/90 bg-white/80 dark:border-white/10 dark:bg-white/[0.03]',
                theme.border,
              )}
            >
              <LeaderboardSkeleton />
            </div>
          ) : showEmptyBoard ? (
            <div
              className={cn(
                'rounded-2xl border p-8 text-center',
                'border-gray-200/90 bg-white/80 dark:border-white/10 dark:bg-white/[0.03]',
                theme.border,
              )}
            >
              <span className="material-symbols-outlined text-4xl text-gray-400">leaderboard</span>
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t('compete.emptyBoard')}</p>
            </div>
          ) : (
            <>
              <LeagueLeaderboardChart entries={entries} scope={scope} leaderScore={topScore} />

              {showPodium ? <LeaguePodium entries={entries} /> : null}

              {listEntries.length > 0 || !showPodium ? (
                <div
                  className={cn(
                    'overflow-hidden rounded-2xl border',
                    'border-gray-200/90 bg-white/80 dark:border-white/10 dark:bg-white/[0.03]',
                    theme.border,
                  )}
                >
                  {boardLoading ? (
                    <LeaderboardSkeleton />
                  ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                      {(showPodium ? listEntries : entries).map((entry) => (
                        <LeaderboardRow
                          key={entry.userId}
                          entry={entry}
                          leaderScore={topScore}
                          promotionRank={promotionRank > 0 ? promotionRank : undefined}
                          sticky={entry.isSelf}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </>
          )}
        </>
      )}
    </CompetePageShell>
  );
};
