import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import { COMPETE_KPI_THEMES } from './competeDashboardStyles';
import { LeagueTierBadge } from './LeagueTierBadge';
import type { LeaderboardEntry } from '../../services/gamificationService';

function rankDisplay(rank: number | null | undefined): React.ReactNode {
  if (rank == null) return '—';
  if (rank === 1) {
    return <span className="material-symbols-outlined text-[20px] text-yellow-500">emoji_events</span>;
  }
  if (rank === 2) {
    return <span className="material-symbols-outlined text-[20px] text-slate-400">military_tech</span>;
  }
  if (rank === 3) {
    return <span className="material-symbols-outlined text-[20px] text-amber-600">workspace_premium</span>;
  }
  return <span className="text-sm font-bold tabular-nums text-gray-500">{rank}</span>;
}

export function LeaderboardRow({
  entry,
  leaderScore,
  promotionRank,
  sticky,
}: {
  entry: LeaderboardEntry;
  leaderScore: number;
  promotionRank?: number;
  sticky?: boolean;
}) {
  const { t } = useI18n();
  const theme = COMPETE_KPI_THEMES.league;
  const name = entry.anonymous
    ? t('compete.anonymousAthlete')
    : entry.displayName ?? t('compete.anonymousAthlete');
  const scorePct =
    entry.weeklyAvg != null && leaderScore > 0
      ? Math.min(100, Math.round((entry.weeklyAvg / leaderScore) * 100))
      : 0;
  const inPromotionZone =
    promotionRank != null && entry.rank != null && entry.rank > 0 && entry.rank <= promotionRank;

  return (
    <li
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-colors',
        entry.isSelf && 'bg-[#158b8d]/8 dark:bg-[#158b8d]/12',
        inPromotionZone && !entry.isSelf && 'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06]',
        sticky &&
          'sticky bottom-0 z-10 border-t border-[#158b8d]/25 bg-white/95 shadow-[0_-8px_24px_-8px_rgba(21,139,141,0.25)] backdrop-blur-md dark:border-[#158b8d]/30 dark:bg-[#0c1220]/95',
      )}
    >
      <div className="flex w-8 shrink-0 items-center justify-center">{rankDisplay(entry.rank)}</div>

      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 ring-2 ring-transparent dark:bg-gray-700',
          entry.isSelf && 'ring-[#158b8d]/40',
        )}
      >
        {entry.avatarUrl ? (
          <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-lg text-gray-500">person</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {name}
            {entry.isSelf ? (
              <span className="ms-1 font-bold text-[#158b8d]">({t('compete.you')})</span>
            ) : null}
          </p>
          <LeagueTierBadge tier={entry.tier} compact className="hidden sm:inline-flex" />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200/90 dark:bg-white/[0.08]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(scorePct, scorePct > 0 ? 6 : 0)}%`,
                background: theme.accent,
                boxShadow: `0 0 8px ${theme.glow}`,
              }}
            />
          </div>
          <span className="shrink-0 text-[10px] tabular-nums text-gray-500">
            {entry.daysCounted} {t('compete.daysShort')}
          </span>
        </div>
      </div>

      <span
        className="shrink-0 text-lg font-extrabold tabular-nums"
        style={{ color: theme.accent }}
      >
        {entry.weeklyAvg ?? '—'}
      </span>
    </li>
  );
}

export function LeaderboardSkeleton() {
  return (
    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
          <div className="h-5 w-8 rounded bg-gray-200 dark:bg-white/[0.08]" />
          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-white/[0.08]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 rounded bg-gray-200 dark:bg-white/[0.08]" />
            <div className="h-1.5 w-full rounded bg-gray-200 dark:bg-white/[0.08]" />
          </div>
          <div className="h-6 w-10 rounded bg-gray-200 dark:bg-white/[0.08]" />
        </li>
      ))}
    </ul>
  );
}
