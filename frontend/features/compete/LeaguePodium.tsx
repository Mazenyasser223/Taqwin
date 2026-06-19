import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import { COMPETE_KPI_THEMES, TIER_BADGE } from './competeDashboardStyles';
import type { LeaderboardEntry } from '../../services/gamificationService';

const PODIUM_RANKS = [2, 1, 3] as const;

const PODIUM_HEIGHT: Record<number, string> = {
  1: 'h-[88px]',
  2: 'h-[68px]',
  3: 'h-[56px]',
};

const PODIUM_MEDAL: Record<number, { icon: string; ring: string; label: string }> = {
  1: { icon: 'emoji_events', ring: 'ring-yellow-500/40', label: 'text-yellow-600 dark:text-yellow-400' },
  2: { icon: 'military_tech', ring: 'ring-slate-400/40', label: 'text-slate-500 dark:text-slate-300' },
  3: { icon: 'workspace_premium', ring: 'ring-amber-600/35', label: 'text-amber-700 dark:text-amber-400' },
};

function PodiumSlot({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const { t } = useI18n();
  const theme = COMPETE_KPI_THEMES.league;
  const medal = PODIUM_MEDAL[rank];
  const tierStyles = TIER_BADGE[entry.tier in TIER_BADGE ? entry.tier : 'bronze'];
  const name = entry.anonymous
    ? t('compete.anonymousAthlete')
    : entry.displayName ?? t('compete.anonymousAthlete');

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center',
        rank === 1 ? 'order-2 -mt-2' : rank === 2 ? 'order-1' : 'order-3',
      )}
    >
      <div
        className={cn(
          'relative mb-2 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full ring-2 sm:h-16 sm:w-16',
          entry.isSelf ? 'ring-[#158b8d]/60' : medal.ring,
          entry.isSelf && 'shadow-[0_0_20px_rgba(21,139,141,0.35)]',
        )}
      >
        {entry.avatarUrl ? (
          <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-2xl text-gray-400">person</span>
        )}
        <span
          className={cn(
            'absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow dark:bg-gray-900',
            medal.label,
          )}
        >
          <span className="material-symbols-outlined text-[14px]">{medal.icon}</span>
        </span>
      </div>

      <p className="max-w-[96px] truncate text-center text-xs font-bold text-gray-900 dark:text-white">
        {name}
        {entry.isSelf ? ` · ${t('compete.you')}` : ''}
      </p>
      <p
        className="mt-0.5 text-lg font-extrabold tabular-nums sm:text-xl"
        style={{ color: theme.accent, textShadow: `0 0 20px ${theme.glow}` }}
      >
        {entry.weeklyAvg ?? '—'}
      </p>

      <div
        className={cn(
          'mt-2 flex w-full max-w-[100px] items-end justify-center rounded-t-xl border border-b-0 px-2 pt-2',
          PODIUM_HEIGHT[rank],
          tierStyles.shell,
          'border-white/20 dark:border-white/10',
          entry.isSelf && 'ring-1 ring-[#158b8d]/30',
        )}
      >
        <span className={cn('text-sm font-extrabold tabular-nums', medal.label)}>#{rank}</span>
      </div>
    </div>
  );
}

export function LeaguePodium({ entries }: { entries: LeaderboardEntry[] }) {
  const byRank = new Map(
    entries.filter((e) => e.rank != null && e.rank <= 3).map((e) => [e.rank as number, e]),
  );
  const slots = PODIUM_RANKS.flatMap((rank) => {
    const entry = byRank.get(rank);
    return entry ? [{ rank, entry }] : [];
  });

  if (slots.length === 0) return null;

  return (
    <div
      className={cn(
        'mb-4 overflow-hidden rounded-2xl border px-3 pb-3 pt-5 sm:px-6',
        'border-gray-200/90 bg-white/80 dark:border-white/10 dark:bg-white/[0.03]',
        COMPETE_KPI_THEMES.league.border,
      )}
    >
      <div className="flex items-end justify-center gap-2 sm:gap-4">
        {slots.map(({ rank, entry }) => (
          <PodiumSlot key={entry.userId} entry={entry} rank={rank} />
        ))}
      </div>
    </div>
  );
}
