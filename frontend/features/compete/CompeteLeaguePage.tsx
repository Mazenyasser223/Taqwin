import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import gamificationService, {
  type LeaderboardEntry,
  type LeaderboardScope,
  type LeagueStatus,
} from '../../services/gamificationService';

const CARD =
  'rounded-xl border border-gray-200/80 bg-white/90 shadow-sm dark:border-gray-800 dark:bg-[#0c1220]/90';

const SCOPES: LeaderboardScope[] = ['league', 'friends', 'gym', 'global'];

const TIER_COLORS: Record<string, string> = {
  bronze: 'text-amber-700 dark:text-amber-400',
  silver: 'text-gray-500 dark:text-gray-300',
  gold: 'text-yellow-600 dark:text-yellow-400',
  diamond: 'text-cyan-600 dark:text-cyan-300',
};

export const CompeteLeaguePage: React.FC = () => {
  const { t } = useI18n();
  const [league, setLeague] = useState<LeagueStatus | null>(null);
  const [scope, setScope] = useState<LeaderboardScope>('league');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const statusRes = await gamificationService.leagueCurrent();
    if (statusRes.error) {
      setError(statusRes.error);
      setLoading(false);
      return;
    }
    const status = statusRes.data ?? { optedIn: false };
    setLeague(status);
    if (!status.optedIn) {
      setLoading(false);
      return;
    }
    const boardRes = await gamificationService.leaderboard(scope);
    if (boardRes.error) setError(boardRes.error);
    else setEntries(boardRes.data?.entries ?? []);
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleJoin = async () => {
    setJoining(true);
    const res = await gamificationService.joinLeague();
    setJoining(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    await load();
  };

  return (
    <div className="page-shell mx-auto w-full max-w-3xl flex-1 pb-8">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/dashboard" className="text-brand-500 hover:text-brand-600">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white">{t('compete.leagueTitle')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('compete.leagueSubtitle')}</p>
        </div>
      </div>

      {error && (
        <div className={cn(CARD, 'mb-4 border-error-500/30 bg-error-500/5 p-4 text-sm text-error-600')}>{error}</div>
      )}

      {!league?.optedIn ? (
        <div className={cn(CARD, 'p-8 text-center')}>
          <span className="material-symbols-outlined text-5xl text-brand-500">emoji_events</span>
          <p className="mt-4 font-semibold text-gray-900 dark:text-white">{t('compete.leagueJoinTitle')}</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('compete.leagueJoinBody')}</p>
          <button
            type="button"
            disabled={joining}
            onClick={() => void handleJoin()}
            className="mt-6 rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {joining ? t('compete.joining') : t('compete.joinLeague')}
          </button>
        </div>
      ) : (
        <>
          <div className={cn(CARD, 'mb-4 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4')}>
            <Stat label={t('compete.tierLabel')} value={t(`compete.tier.${league.tier ?? 'bronze'}` as never)} tier={league.tier} />
            <Stat label={t('compete.weeklyAvg')} value={league.weeklyAvg != null ? String(league.weeklyAvg) : '—'} />
            <Stat label={t('compete.yourRank')} value={league.rank != null ? `#${league.rank}` : '—'} />
            <Stat
              label={t('compete.daysLabel')}
              value={`${league.daysCounted ?? 0}/${league.daysRequired ?? 3}`}
            />
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {SCOPES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition',
                  scope === s
                    ? 'bg-brand-500 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300',
                )}
              >
                {t(`compete.scope.${s}` as never)}
              </button>
            ))}
          </div>

          <div className={cn(CARD, 'overflow-hidden')}>
            {loading ? (
              <p className="p-6 text-center text-sm text-gray-500 animate-pulse">{t('compete.loadingBoard')}</p>
            ) : entries.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('compete.emptyBoard')}</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {entries.map((entry) => (
                  <li
                    key={entry.userId}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3',
                      entry.isSelf && 'bg-brand-500/5 dark:bg-brand-500/10',
                    )}
                  >
                    <span className="w-8 text-center text-sm font-bold text-gray-500">
                      {entry.rank != null ? entry.rank : '—'}
                    </span>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      {entry.avatarUrl ? (
                        <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-lg text-gray-500">person</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {entry.anonymous ? t('compete.anonymousAthlete') : entry.displayName ?? t('compete.anonymousAthlete')}
                        {entry.isSelf ? ` (${t('compete.you')})` : ''}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {entry.daysCounted} {t('compete.daysShort')} · {t(`compete.tier.${entry.tier}` as never)}
                      </p>
                    </div>
                    <span className="text-lg font-extrabold text-brand-600 dark:text-brand-400">
                      {entry.weeklyAvg ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

function Stat({ label, value, tier }: { label: string; value: string; tier?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      <p className={cn('mt-1 text-lg font-extrabold text-gray-900 dark:text-white', tier && TIER_COLORS[tier])}>
        {value}
      </p>
    </div>
  );
}
