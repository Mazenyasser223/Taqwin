import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import { TIER_BADGE } from './competeDashboardStyles';

const TIER_ICONS: Record<string, string> = {
  bronze: 'military_tech',
  silver: 'workspace_premium',
  gold: 'emoji_events',
  diamond: 'diamond',
};

export function LeagueTierBadge({
  tier,
  rank,
  className,
  compact = false,
}: {
  tier: string;
  rank?: number | null;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const key = tier in TIER_BADGE ? tier : 'bronze';
  const styles = TIER_BADGE[key];
  const tierKey = `compete.tier.${key}` as import('../../lib/i18n/translations').TranslationKey;

  if (compact) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-lg border border-white/15 px-1.5 py-0.5',
          'ring-1 backdrop-blur-sm dark:border-white/10',
          styles.shell,
          styles.ring,
          className,
        )}
        title={rank != null ? `${t(tierKey)} · ${t('compete.yourRank')} #${rank}` : t(tierKey)}
      >
        <span className={cn('material-symbols-outlined text-[14px]', styles.icon)}>
          {TIER_ICONS[key]}
        </span>
        <span className={cn('text-[10px] font-bold uppercase tracking-wide', styles.label)}>
          {t(tierKey)}
        </span>
        {rank != null ? (
          <span className="text-[10px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">
            #{rank}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-xl border border-white/20 px-2.5 py-1.5',
        'ring-1 backdrop-blur-sm dark:border-white/10',
        styles.shell,
        styles.ring,
        styles.glow,
        className,
      )}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/60 dark:bg-white/10">
        <span className={cn('material-symbols-outlined text-[18px]', styles.icon)}>{TIER_ICONS[key]}</span>
      </div>
      <div className="min-w-0 leading-tight">
        <p className={cn('text-[11px] font-extrabold uppercase tracking-wide', styles.label)}>{t(tierKey)}</p>
        {rank != null ? (
          <p className="text-[10px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">
            {t('compete.yourRank')} #{rank}
          </p>
        ) : null}
      </div>
    </div>
  );
}
