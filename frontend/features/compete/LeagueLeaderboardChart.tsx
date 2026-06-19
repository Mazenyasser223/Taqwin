import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import { COMPETE_KPI_THEMES } from './competeDashboardStyles';
import { forwardWheelToAppScroll } from '../../lib/forwardWheelToAppScroll';
import type { LeaderboardEntry, LeaderboardScope } from '../../services/gamificationService';

type ChartPoint = {
  id: string;
  label: string;
  score: number;
  isSelf: boolean;
  rank: number | null;
  daysCounted: number;
};

function truncateLabel(label: string, max = 14) {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

function ChartTooltip({
  active,
  payload,
  t,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
  t: (key: import('../../lib/i18n/translations').TranslationKey, params?: Record<string, string>) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="min-w-[148px] rounded-xl border border-white/15 bg-gray-950/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
      <p className="text-[11px] font-semibold text-white/90">{point.label}</p>
      <p className="mt-0.5 text-base font-extrabold tabular-nums text-white">
        {point.score}{' '}
        <span className="text-[11px] font-medium text-white/70">{t('compete.weeklyAvg')}</span>
      </p>
      {point.rank != null ? (
        <p className="mt-1 text-[10px] text-white/75">
          #{point.rank} · {point.daysCounted} {t('compete.daysShort')}
        </p>
      ) : null}
    </div>
  );
}

export function LeagueLeaderboardChart({
  entries,
  scope,
  leaderScore,
}: {
  entries: LeaderboardEntry[];
  scope: LeaderboardScope;
  leaderScore: number;
}) {
  const { t } = useI18n();
  const theme = COMPETE_KPI_THEMES.league;
  const accent = theme.accent;
  const accentMuted = 'rgba(21, 139, 141, 0.45)';

  const chartData = useMemo<ChartPoint[]>(() => {
    return entries
      .filter((e) => e.weeklyAvg != null && e.weeklyAvg > 0)
      .slice(0, 10)
      .map((e) => {
        const name = e.anonymous
          ? t('compete.anonymousAthlete')
          : e.displayName ?? t('compete.anonymousAthlete');
        const label = e.isSelf ? `${truncateLabel(name)} · ${t('compete.you')}` : truncateLabel(name);
        return {
          id: e.userId,
          label,
          score: e.weeklyAvg as number,
          isSelf: e.isSelf,
          rank: e.rank ?? null,
          daysCounted: e.daysCounted,
        };
      });
  }, [entries, t]);

  const maxScore = useMemo(
    () => Math.max(leaderScore, ...chartData.map((d) => d.score), 100),
    [chartData, leaderScore],
  );

  if (chartData.length === 0) return null;

  const chartHeight = Math.min(360, Math.max(140, chartData.length * 40 + 24));

  return (
    <div
      className={cn(
        'mb-4 overflow-hidden rounded-2xl border p-4 sm:p-5',
        'border-gray-200/90 bg-white/80 dark:border-white/10 dark:bg-white/[0.03]',
        theme.border,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t('compete.leaderboardChartTitle')}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {t(`compete.scope.${scope}` as never)}
          </p>
        </div>
        <span className="material-symbols-outlined text-[20px]" style={{ color: accent }}>
          bar_chart
        </span>
      </div>

      <div
        style={{ height: chartHeight }}
        className="compete-chart-scroll w-full min-w-0"
        onWheel={forwardWheelToAppScroll}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
            barCategoryGap="18%"
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148,163,184,0.2)" />
            <XAxis
              type="number"
              domain={[0, maxScore]}
              tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.9)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => String(v)}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={108}
              tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.95)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(21, 139, 141, 0.08)' }}
              content={<ChartTooltip t={t} />}
            />
            <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={22}>
              {chartData.map((row) => (
                <Cell
                  key={row.id}
                  fill={row.isSelf ? accent : accentMuted}
                  style={row.isSelf ? { filter: `drop-shadow(0 0 6px ${theme.glow})` } : undefined}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
