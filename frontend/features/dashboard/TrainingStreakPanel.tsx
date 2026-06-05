import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import type { TranslationKey } from '../../lib/i18n/translations';
import type { AthleteHomeDashboard } from '../../services/dashboardService';
import { formatMinutesShort, formatWeekdayLabel } from './dashboardLocale';

const BRAND = '#158b8d';

type Props = {
  data: AthleteHomeDashboard;
  showWorkoutCta?: boolean;
  onClose?: () => void;
};

export function TrainingStreakPanel({ data, showWorkoutCta = true, onClose }: Props) {
  const { t, language } = useI18n();
  const todayKey = data.today.date;
  const streak = data.streak;
  const cells = data.heatmap;

  const stats = useMemo(() => {
    const activeDays = cells.filter((c) => c.workouts > 0).length;
    const totalWorkouts = cells.reduce((s, c) => s + c.workouts, 0);
    const totalMinutes = cells.reduce((s, c) => s + c.minutes, 0);
    const maxWorkouts = Math.max(1, ...cells.map((c) => c.workouts));
    return { activeDays, totalWorkouts, totalMinutes, maxWorkouts };
  }, [cells]);

  const statusKey: TranslationKey =
    streak >= 7
      ? 'dashboard.streakOnFire'
      : streak >= 3
        ? 'dashboard.streakMomentum'
        : streak >= 1
          ? 'dashboard.streakKeepGoing'
          : 'dashboard.streakStartToday';
  const flameColor = streak >= 7 ? '#f97316' : streak >= 3 ? BRAND : streak >= 1 ? '#6366f1' : '#94a3b8';

  const weeks = useMemo(() => {
    const chunks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      chunks.push(cells.slice(i, i + 7));
    }
    return chunks;
  }, [cells]);

  const weekdayLabels = useMemo(() => {
    const sample = cells.length >= 7 ? cells.slice(0, 7) : cells;
    return sample.map((c) => formatWeekdayLabel(c.day || c.date, language, t));
  }, [cells, language, t]);

  function cellIntensity(workouts: number, maxWorkouts: number) {
    if (workouts <= 0) return 0;
    if (workouts >= maxWorkouts) return 1;
    return 0.35 + (workouts / maxWorkouts) * 0.55;
  }

  return (
    <div className="relative min-w-0">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-25 blur-3xl"
        style={{ background: '#f97316' }}
      />
      <div
        className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full opacity-15 blur-3xl"
        style={{ background: BRAND }}
      />

      <div className="relative z-[1]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/35 to-amber-500/20 text-orange-500 ring-1 ring-orange-500/30 dark:text-orange-300">
              <span className="material-symbols-outlined text-2xl">local_fire_department</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white sm:text-lg">
                {t('dashboard.streakHeatmap')}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {t('dashboard.streakHeatmapHint')}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-sm"
              style={{ background: flameColor }}
            >
              {t(statusKey)}
            </span>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="size-10 rounded-xl bg-elevated border border-subtle flex items-center justify-center text-faint hover:text-foreground"
                aria-label={t('common.cancel')}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-500/15 ring-1 ring-brand-500/30">
            <span className="material-symbols-outlined text-2xl text-brand-600 dark:text-brand-400">
              trending_up
            </span>
          </div>
          <div className="flex items-end gap-1.5">
            <span className="text-5xl font-extrabold tabular-nums leading-none text-gray-900 dark:text-white">
              {streak}
            </span>
            <div className="pb-1">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                {t('dashboard.streakDayStreak')}
              </p>
              <p className="text-[10px] font-semibold text-gray-500">{t('dashboard.streakLast28')}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-brand-500/25 bg-brand-500/8 px-2 py-2 text-center dark:bg-brand-500/12">
            <p className="text-[9px] font-bold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              {t('dashboard.streakActiveDays28')}
            </p>
            <p className="mt-0.5 text-lg font-extrabold tabular-nums text-brand-600 dark:text-brand-400">
              {stats.activeDays}
              <span className="text-xs font-semibold text-gray-500">/28</span>
            </p>
          </div>
          <div className="rounded-xl border border-gray-200/90 bg-gray-50/90 px-2 py-2 text-center dark:border-gray-700 dark:bg-white/[0.04]">
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500">
              {t('dashboard.streakWorkouts28')}
            </p>
            <p className="mt-0.5 text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">
              {stats.totalWorkouts}
            </p>
          </div>
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/8 px-2 py-2 text-center dark:bg-orange-500/10">
            <p className="text-[9px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
              {t('dashboard.streakMinutes28')}
            </p>
            <p className="mt-0.5 text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">
              {stats.totalMinutes}
            </p>
          </div>
        </div>

        <div className="mt-4 min-w-0" dir="ltr">
          <div className="mb-1.5 grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-1 sm:gap-1.5">
            <div className="w-8" />
            {weekdayLabels.map((label) => (
              <div
                key={`day-h-${label}`}
                className="text-center text-[8px] font-bold uppercase tracking-wide text-gray-400 sm:text-[9px]"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] gap-x-1 gap-y-1 sm:gap-x-1.5 sm:gap-y-1.5">
            {weeks.map((week, wi) => (
              <React.Fragment key={`week-row-${wi}`}>
                <div className="flex w-8 items-center text-[8px] font-bold uppercase text-gray-400 sm:text-[9px]">
                  {t('dashboard.weekShort', { week: String(wi + 1) })}
                </div>
                {week.map((cell, dayIdx) => {
                  if (!cell) {
                    return <div key={`empty-${wi}-${dayIdx}`} className="aspect-square min-h-[10px]" />;
                  }
                  const isToday = cell.date === todayKey;
                  const intensity = cellIntensity(cell.workouts, stats.maxWorkouts);
                  const title = t('dashboard.streakCellTooltip', {
                    date: cell.date,
                    workouts: String(cell.workouts),
                    workoutLabel: t('dashboard.streakWorkoutLabel'),
                    minutes: formatMinutesShort(cell.minutes, t),
                  });
                  return (
                    <div
                      key={cell.date}
                      title={title}
                      className={cn(
                        'aspect-square min-h-[10px] min-w-0 rounded-[4px] border transition sm:rounded-md',
                        cell.workouts === 0
                          ? 'border-gray-200/80 bg-gray-100/90 dark:border-gray-700/80 dark:bg-white/[0.04]'
                          : 'border-brand-500/30',
                        isToday &&
                          'ring-2 ring-orange-400/70 ring-offset-1 ring-offset-white dark:ring-offset-[#0c1220]'
                      )}
                      style={
                        cell.workouts > 0
                          ? {
                              background: `rgba(21, 139, 141, ${0.22 + intensity * 0.68})`,
                              boxShadow:
                                intensity >= 0.85 ? '0 0 10px rgba(21, 139, 141, 0.35)' : undefined,
                            }
                          : undefined
                      }
                    />
                  );
                })}
                {week.length < 7 &&
                  Array.from({ length: 7 - week.length }).map((_, padIdx) => (
                    <div key={`pad-${wi}-${padIdx}`} className="aspect-square min-h-[10px]" />
                  ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-500">
            <span>{t('dashboard.streakLegendLess')}</span>
            <div className="flex gap-0.5">
              {[0, 0.35, 0.65, 1].map((level) => (
                <span
                  key={level}
                  className="h-3 w-3 rounded-sm border border-brand-500/20 sm:h-3.5 sm:w-3.5"
                  style={{
                    background:
                      level === 0
                        ? 'rgba(148, 163, 184, 0.25)'
                        : `rgba(21, 139, 141, ${0.25 + level * 0.65})`,
                  }}
                />
              ))}
            </div>
            <span>{t('dashboard.streakLegendMore')}</span>
          </div>
          {showWorkoutCta && streak === 0 && (
            <Link
              to="/workouts"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-600 hover:underline dark:text-brand-400"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              {t('dashboard.workoutLogCta')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
