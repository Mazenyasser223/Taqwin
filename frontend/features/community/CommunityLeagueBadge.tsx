import React from 'react';
import type { CommunityLeagueBadge as CommunityLeagueBadgeType } from '../../types';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';

const TIER_ICONS: Record<string, string> = {
  bronze: 'military_tech',
  silver: 'workspace_premium',
  gold: 'emoji_events',
  diamond: 'diamond',
};

/** Same pill pattern as RoleBadge — tier-tinted bg/text/ring. */
const TIER_PILL: Record<string, { bg: string; text: string; ring: string }> = {
  bronze: {
    bg: 'bg-orange-900/20',
    text: 'text-orange-900 dark:text-orange-300',
    ring: 'ring-orange-800/30',
  },
  silver: {
    bg: 'bg-slate-400/20',
    text: 'text-slate-600 dark:text-slate-300',
    ring: 'ring-slate-400/25',
  },
  gold: {
    bg: 'bg-yellow-400/20',
    text: 'text-yellow-500 dark:text-yellow-300',
    ring: 'ring-yellow-400/30',
  },
  diamond: {
    bg: 'bg-cyan-500/20',
    text: 'text-cyan-600 dark:text-cyan-400',
    ring: 'ring-cyan-400/25',
  },
};

const PILL_BASE =
  'inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.1em] sm:tracking-[0.14em] leading-none shrink-0 ring-1';

export function CommunityLeagueBadge({
  league,
  className,
}: {
  league?: CommunityLeagueBadgeType | null;
  className?: string;
}) {
  const { t } = useI18n();
  if (!league?.tier) return null;

  const key = league.tier in TIER_PILL ? league.tier : 'bronze';
  const pill = TIER_PILL[key];
  const tierKey = `compete.tier.${key}` as import('../../lib/i18n/translations').TranslationKey;
  const tierLabel = t(tierKey);

  return (
    <span
      className={cn(PILL_BASE, pill.bg, pill.text, pill.ring, className)}
      title={league.rank != null ? `${tierLabel} · #${league.rank}` : tierLabel}
    >
      <span
        className="material-symbols-outlined text-[12px] sm:text-sm leading-none shrink-0"
        style={{ fontVariationSettings: "'FILL' 1" }}
        aria-hidden
      >
        {TIER_ICONS[key]}
      </span>
      <span className="relative top-px whitespace-nowrap">{tierLabel}</span>
      {league.rank != null ? (
        <span className="relative top-px whitespace-nowrap tabular-nums">#{league.rank}</span>
      ) : null}
    </span>
  );
}
