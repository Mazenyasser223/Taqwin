import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import { COMPETE_KPI_THEMES } from './competeDashboardStyles';
import type { LeaderboardScope } from '../../services/gamificationService';

const SCOPES: LeaderboardScope[] = ['league', 'friends', 'gym', 'global'];

const SCOPE_ICONS: Record<LeaderboardScope, string> = {
  league: 'emoji_events',
  friends: 'group',
  gym: 'fitness_center',
  global: 'public',
};

export function LeagueScopeTabs({
  scope,
  onChange,
}: {
  scope: LeaderboardScope;
  onChange: (scope: LeaderboardScope) => void;
}) {
  const { t } = useI18n();
  const theme = COMPETE_KPI_THEMES.league;

  return (
    <div
      className={cn(
        'mb-4 flex flex-wrap gap-1 rounded-2xl border p-1',
        'border-gray-200/90 bg-white/60 dark:border-white/10 dark:bg-white/[0.04]',
        theme.border,
      )}
      role="tablist"
      aria-label={t('compete.leagueTitle')}
    >
      {SCOPES.map((s) => {
        const active = scope === s;
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s)}
            className={cn(
              'inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition sm:px-3 sm:text-xs',
              active
                ? 'text-white shadow-md'
                : 'text-gray-600 hover:bg-white/80 dark:text-gray-300 dark:hover:bg-white/[0.06]',
            )}
            style={
              active
                ? {
                    background: theme.accent,
                    boxShadow: `0 4px 16px -4px ${theme.glow}`,
                  }
                : undefined
            }
          >
            <span className="material-symbols-outlined text-[16px]">{SCOPE_ICONS[s]}</span>
            <span className="truncate">{t(`compete.scope.${s}` as never)}</span>
          </button>
        );
      })}
    </div>
  );
}
