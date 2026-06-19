import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import { COMPETE_KPI_THEMES, TIER_BADGE } from './competeDashboardStyles';

const TIERS = ['bronze', 'silver', 'gold', 'diamond'] as const;
const TIER_ICONS: Record<string, string> = {
  bronze: 'military_tech',
  silver: 'workspace_premium',
  gold: 'emoji_events',
  diamond: 'diamond',
};

export function LeagueJoinHero({
  joining,
  onJoin,
}: {
  joining: boolean;
  onJoin: () => void;
}) {
  const { t } = useI18n();
  const theme = COMPETE_KPI_THEMES.league;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-8 text-center md:p-10',
        'bg-white/90 backdrop-blur-xl dark:bg-white/[0.04]',
        theme.border,
      )}
      style={{
        boxShadow: `0 8px 32px -8px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
      }}
    >
      <div
        className="pointer-events-none absolute -left-16 top-0 h-40 w-40 rounded-full opacity-30 blur-3xl"
        style={{ background: theme.accent }}
      />
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-95', theme.wash)} />

      <div className="relative z-[1]">
        <div
          className={cn(
            'mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ring-white/20',
            theme.iconFrom,
            theme.iconTo,
          )}
          style={{ boxShadow: `0 12px 28px -8px ${theme.glow}` }}
        >
          <span className="material-symbols-outlined text-4xl" style={{ color: theme.accent }}>
            emoji_events
          </span>
        </div>

        <p className="mt-5 text-lg font-extrabold text-gray-900 dark:text-white">
          {t('compete.leagueJoinTitle')}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          {t('compete.leagueJoinBody')}
        </p>

        <div className="mx-auto mt-6 flex max-w-sm flex-wrap items-center justify-center gap-2">
          {TIERS.map((tier) => {
            const styles = TIER_BADGE[tier];
            return (
              <div
                key={tier}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg px-2 py-1 ring-1',
                  styles.shell,
                  styles.ring,
                )}
              >
                <span className={cn('material-symbols-outlined text-[14px]', styles.icon)}>
                  {TIER_ICONS[tier]}
                </span>
                <span className={cn('text-[10px] font-bold uppercase', styles.label)}>
                  {t(`compete.tier.${tier}` as never)}
                </span>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          disabled={joining}
          onClick={onJoin}
          className="mt-8 rounded-xl px-8 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
          style={{
            background: theme.accent,
            boxShadow: `0 8px 24px -6px ${theme.glow}`,
          }}
        >
          {joining ? t('compete.joining') : t('compete.joinLeague')}
        </button>
      </div>
    </div>
  );
}
