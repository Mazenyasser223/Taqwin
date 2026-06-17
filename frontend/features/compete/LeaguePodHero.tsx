import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import { COMPETE_KPI_THEMES } from './competeDashboardStyles';
import { LeagueTierBadge } from './LeagueTierBadge';
import { CompeteMetricRow, CompeteProgressBar } from './CompeteDashboardCardShell';
import type { LeagueStatus } from '../../services/gamificationService';
import { daysUntilDateKey } from './competeLeagueUtils';

export function LeaguePodHero({ league }: { league: LeagueStatus }) {
  const { t } = useI18n();
  const theme = COMPETE_KPI_THEMES.league;
  const tier = league.tier ?? 'bronze';
  const daysRequired = league.daysRequired ?? 3;
  const daysCounted = league.daysCounted ?? 0;
  const daysProgress =
    daysRequired > 0 ? Math.min(100, Math.round((daysCounted / daysRequired) * 100)) : 0;
  const weekDaysLeft = league.season?.weekEnd ? daysUntilDateKey(league.season.weekEnd) : null;
  const rankLabel =
    league.rank != null && league.podSize
      ? `#${league.rank} / ${league.podSize}`
      : league.rank != null
        ? `#${league.rank}`
        : '—';

  return (
    <div
      className={cn(
        'relative mb-4 overflow-hidden rounded-2xl border p-5 md:p-6',
        'bg-white/90 backdrop-blur-xl dark:bg-white/[0.04]',
        theme.border,
      )}
      style={{
        boxShadow: `0 8px 32px -8px ${theme.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
        ['--compete-accent' as string]: theme.accent,
        ['--compete-glow' as string]: theme.glow,
      }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40 blur-2xl"
        style={{ background: theme.accent }}
      />
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90', theme.wash)} />

      <div className="relative z-[1]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ring-white/20 dark:ring-white/10',
                theme.iconFrom,
                theme.iconTo,
              )}
              style={{ boxShadow: `0 10px 24px -8px ${theme.glow}` }}
            >
              <span className="material-symbols-outlined text-[22px]" style={{ color: theme.accent }}>
                emoji_events
              </span>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400/90">
                {t('compete.leagueTitle')}
              </p>
              {weekDaysLeft != null ? (
                <p className="mt-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                  {t('compete.daysLeftInline', { count: String(weekDaysLeft) })}
                </p>
              ) : null}
            </div>
          </div>
          <LeagueTierBadge tier={tier} rank={league.rank} />
        </div>

        <div className="mt-4">
          <CompeteMetricRow
            items={[
              { value: league.weeklyAvg ?? '—', label: t('compete.weeklyAvg') },
              { value: rankLabel, label: t('compete.yourRank') },
            ]}
          />
        </div>

        <CompeteProgressBar
          pct={daysProgress}
          label={t('compete.daysCounted', {
            count: String(daysCounted),
            required: String(daysRequired),
          })}
        />
      </div>
    </div>
  );
}
