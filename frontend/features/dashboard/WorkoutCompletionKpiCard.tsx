import React, { useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import type { AthleteHomeDashboard } from '../../services/dashboardService';
import { TrainingStreakDetailsModal } from './TrainingStreakDetailsModal';

const BRAND = '#158b8d';

function MiniProgressRing({ percent, color }: { percent: number; color: string }) {
  const r = 17;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90 shrink-0" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" className="text-gray-200/80 dark:text-white/10" strokeWidth="3" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-[stroke-dashoffset] duration-700 ease-out"
        style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
      />
    </svg>
  );
}

export function WorkoutCompletionKpiCard({
  data,
  workoutCompletionWeek,
  workoutCompletionToday,
  trainingTarget,
}: {
  data: AthleteHomeDashboard;
  workoutCompletionWeek: number;
  workoutCompletionToday: number;
  trainingTarget: number;
}) {
  const { t } = useI18n();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [touchFlipped, setTouchFlipped] = useState(false);

  const style = {
    accent: BRAND,
    glow: 'rgba(21, 139, 141, 0.35)',
    border: 'border-[#158b8d]/25 dark:border-[#158b8d]/35',
    wash: 'from-[#158b8d]/18 via-[#158b8d]/5 to-transparent',
    iconFrom: 'from-[#158b8d]/45',
    iconTo: 'to-[#158b8d]/10',
  };

  const pct = Math.min(100, Math.max(0, workoutCompletionToday));

  const streakStats = useMemo(() => {
    const cells = data.heatmap;
    return {
      streak: data.streak,
      activeDays: cells.filter((c) => c.workouts > 0).length,
      totalWorkouts: cells.reduce((s, c) => s + c.workouts, 0),
      totalMinutes: cells.reduce((s, c) => s + c.minutes, 0),
    };
  }, [data.heatmap, data.streak]);

  const flipActive = touchFlipped;

  const sub = `${data.totals.workouts}/${trainingTarget} ${t('dashboard.thisWeek')} · ${t('dashboard.kpiWeekSuffix', { pct: String(workoutCompletionWeek) })}`;

  return (
    <>
      <div
        className={cn(
          'group relative min-h-[168px] overflow-hidden rounded-2xl border p-5 md:p-6',
          'bg-white/90 backdrop-blur-xl dark:bg-white/[0.04]',
          style.border,
          'transition-shadow duration-300 hover:shadow-2xl',
          '[perspective:1000px]'
        )}
        style={{ boxShadow: `0 8px 32px -8px ${style.glow}, inset 0 1px 0 rgba(255,255,255,0.12)` }}
        onClick={() => {
          if (window.matchMedia('(hover: none)').matches) {
            setTouchFlipped((v) => !v);
          }
        }}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover:opacity-70"
          style={{ background: style.accent }}
        />
        <div className={cn('pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br opacity-90', style.wash)} />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDetailsOpen(true);
          }}
          className="absolute end-5 top-5 z-20 size-11 rounded-xl border border-subtle bg-elevated text-foreground flex items-center justify-center transition-colors hover:border-accent/40 hover:text-accent dark:bg-white/[0.08]"
          aria-label={t('dashboard.streakHeatmap')}
        >
          <span className="material-symbols-outlined text-[22px]">info</span>
        </button>

        <div
          className={cn(
            'relative z-[1] min-h-[108px] transition-transform duration-500 [transform-style:preserve-3d]',
            flipActive && '[transform:rotateY(180deg)]',
            '[@media(hover:hover)]:group-hover:[transform:rotateY(180deg)]'
          )}
        >
          <div className="[backface-visibility:hidden]">
            <div className="flex items-start justify-between gap-3 pe-14">
              <div
                className={cn(
                  'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg',
                  style.iconFrom,
                  style.iconTo,
                  'ring-1 ring-white/20 dark:ring-white/10'
                )}
                style={{ boxShadow: `0 10px 24px -8px ${style.glow}` }}
              >
                <span className="material-symbols-outlined text-[22px]" style={{ color: style.accent }}>
                  fitness_center
                </span>
              </div>
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                <MiniProgressRing percent={pct} color={style.accent} />
                <span
                  className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
                  style={{ color: style.accent }}
                >
                  {Math.round(pct)}
                </span>
              </div>
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400/90">
              {t('dashboard.workoutCompletion')}
            </p>
            <p
              className="mt-1.5 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-[1.65rem]"
              style={{ textShadow: `0 0 40px ${style.glow}` }}
            >
              {workoutCompletionToday}%
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-200/90 dark:bg-white/[0.08]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: style.accent, boxShadow: `0 0 12px ${style.glow}` }}
              />
            </div>
          </div>

          <div className="absolute inset-0 flex flex-col justify-center pe-14 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400/90">
              {t('dashboard.streakHeatmap')}
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="material-symbols-outlined text-3xl text-orange-500">local_fire_department</span>
              <p className="text-3xl font-extrabold tabular-nums text-gray-900 dark:text-white">
                {streakStats.streak}
              </p>
              <p className="pb-0.5 text-sm font-bold text-gray-600 dark:text-gray-300">
                {t('dashboard.streakDayStreak')}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <div className="rounded-lg border border-brand-500/25 bg-brand-500/10 px-1 py-1.5 text-center">
                <p className="text-[8px] font-bold uppercase text-brand-600 dark:text-brand-400">
                  {t('dashboard.streakActiveDays28')}
                </p>
                <p className="text-sm font-extrabold tabular-nums text-brand-600 dark:text-brand-400">
                  {streakStats.activeDays}/28
                </p>
              </div>
              <div className="rounded-lg border border-gray-200/80 bg-gray-50/80 px-1 py-1.5 text-center dark:border-gray-700 dark:bg-white/[0.04]">
                <p className="text-[8px] font-bold uppercase text-gray-500">
                  {t('dashboard.streakWorkouts28')}
                </p>
                <p className="text-sm font-extrabold tabular-nums text-gray-900 dark:text-white">
                  {streakStats.totalWorkouts}
                </p>
              </div>
              <div className="rounded-lg border border-orange-500/25 bg-orange-500/10 px-1 py-1.5 text-center">
                <p className="text-[8px] font-bold uppercase text-orange-600 dark:text-orange-400">
                  {t('dashboard.streakMinutes28')}
                </p>
                <p className="text-sm font-extrabold tabular-nums text-gray-900 dark:text-white">
                  {streakStats.totalMinutes}
                </p>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-gray-500 dark:text-gray-400">
              {t('dashboard.workoutFlipHint')}
            </p>
          </div>
        </div>
      </div>

      <TrainingStreakDetailsModal open={detailsOpen} onClose={() => setDetailsOpen(false)} data={data} />
    </>
  );
}
