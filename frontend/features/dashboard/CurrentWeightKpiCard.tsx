import React, { useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import type { AthleteHomeDashboard } from '../../services/dashboardService';
import {
  WEIGHT_WINDOW_WEEKS,
  buildWeightWeekSeries,
  scaleWeightWeekBars,
  sliceWeightWeekWindow,
  weightDeltaVsLastWeek,
  weekOverWeekDeltas,
  withWeekNumbers,
} from './weightHistory';
import {
  mergeWeightLogs,
  parseServerWeightLog,
  readLocalWeightLog,
  withProfileWeightBaseline,
} from './weightLogStore';

const ACCENT = '#6366f1';

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

function WeightBackButton({
  onClick,
  disabled,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-md border border-subtle bg-elevated/90 text-faint transition-colors',
        'hover:border-[#6366f1]/35 hover:text-[#6366f1]',
        'disabled:pointer-events-none disabled:opacity-35'
      )}
    >
      {children}
    </button>
  );
}

export function CurrentWeightKpiCard({
  data,
  userId,
  bodyScore,
}: {
  data: AthleteHomeDashboard;
  userId?: string;
  bodyScore: number;
}) {
  const { t, language } = useI18n();
  const [touchFlipped, setTouchFlipped] = useState(false);
  const [weeksBack, setWeeksBack] = useState(0);

  const style = {
    accent: ACCENT,
    glow: 'rgba(99, 102, 241, 0.38)',
    border: 'border-[#6366f1]/25 dark:border-[#6366f1]/35',
    wash: 'from-[#6366f1]/22 via-[#6366f1]/6 to-transparent',
    iconFrom: 'from-[#6366f1]/50',
    iconTo: 'to-[#6366f1]/10',
  };

  const weightDisplay =
    data.profile.weight != null ? `${data.profile.weight} ${t('dashboard.kg')}` : '—';

  const pct = Math.min(100, Math.max(0, bodyScore));
  const flipActive = touchFlipped;
  const today = data.today.date;

  const weightEntries = useMemo(() => {
    const server = parseServerWeightLog(data.analytics?.weightLog);
    const local = readLocalWeightLog(userId);
    const merged = mergeWeightLogs(server, local);
    return withProfileWeightBaseline(merged, data.profile.weight, today);
  }, [data.analytics?.weightLog, userId, data.profile.weight, today]);

  const weekDelta = useMemo(
    () => weightDeltaVsLastWeek(weightEntries, today),
    [weightEntries, today]
  );

  const sub =
    data.profile.weight == null
      ? t('dashboard.weightLogEmpty')
      : weekDelta == null
        ? t('dashboard.weightWeekOneHint')
        : weekDelta === 0
          ? t('dashboard.weightVsLastWeekSame')
          : t('dashboard.weightVsLastWeek', {
              delta: `${weekDelta > 0 ? '+' : ''}${weekDelta} ${t('dashboard.kg')}`,
            });

  const weightWeeks = useMemo(
    () => withWeekNumbers(buildWeightWeekSeries(weightEntries, today, language)),
    [weightEntries, today, language]
  );

  const weekDeltas = useMemo(() => weekOverWeekDeltas(weightWeeks), [weightWeeks]);

  const { visible, weeksBack: clampedBack, maxWeeksBack } = useMemo(
    () => sliceWeightWeekWindow(weightWeeks, weeksBack),
    [weightWeeks, weeksBack]
  );

  const trendBars = useMemo(() => scaleWeightWeekBars(visible), [visible]);
  const canGoBack = clampedBack < maxWeeksBack;
  const hasLoggedWeek = visible.some((w) => w.weight != null);

  const rangeLabel =
    visible.length > 0
      ? `${visible[0].label} – ${visible[visible.length - 1].label}`
      : null;

  return (
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

      <div
        className={cn(
          'relative z-[1] min-h-[108px] transition-transform duration-500 [transform-style:preserve-3d]',
          flipActive && '[transform:rotateY(180deg)]',
          '[@media(hover:hover)]:group-hover:[transform:rotateY(180deg)]'
        )}
      >
        <div className="[backface-visibility:hidden]">
          <div className="flex items-start justify-between gap-3">
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
                scale
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
            {t('dashboard.currentWeight')}
          </p>
          <p
            className="mt-1.5 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-[#ffffff] md:text-[1.65rem]"
            style={{ textShadow: `0 0 40px ${style.glow}` }}
          >
            {weightDisplay}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-200/90 dark:bg-white/[0.08]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: style.accent, boxShadow: `0 0 12px ${style.glow}` }}
            />
          </div>
        </div>

        <div className="absolute inset-0 flex flex-col [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400/90">
            {t('dashboard.weightFlipTitle')}
          </p>
          {clampedBack > 0 && rangeLabel ? (
            <p className="mt-0.5 text-center text-[9px] font-semibold tabular-nums text-muted">{rangeLabel}</p>
          ) : null}

          {!hasLoggedWeek && weightEntries.length === 0 ? (
            <p className="mt-4 flex flex-1 items-center justify-center px-2 text-center text-xs text-muted">
              {t('dashboard.weightLogEmpty')}
            </p>
          ) : (
            <div className="mt-2 flex flex-1 items-stretch gap-1.5" dir="ltr">
              <div className="flex shrink-0 flex-col justify-center gap-0.5">
                <WeightBackButton
                  onClick={() => setWeeksBack((prev) => Math.min(prev + 1, maxWeeksBack))}
                  disabled={!canGoBack}
                  ariaLabel={t('dashboard.weightHistoryBackWeek')}
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </WeightBackButton>
                <WeightBackButton
                  onClick={() =>
                    setWeeksBack((prev) => Math.min(prev + WEIGHT_WINDOW_WEEKS, maxWeeksBack))
                  }
                  disabled={!canGoBack}
                  ariaLabel={t('dashboard.weightHistoryBackMonth')}
                >
                  <span className="text-[8px] font-bold uppercase leading-none tracking-wide">4w</span>
                </WeightBackButton>
              </div>

              <div className="flex min-w-0 flex-1 items-end justify-between gap-1">
                {trendBars.map((w) => (
                  <div
                    key={w.weekStart}
                    className={cn(
                      'flex min-w-0 flex-1 flex-col items-center gap-0.5',
                      w.isCurrentWeek && w.weight != null && 'rounded-md ring-1 ring-[#6366f1]/40'
                    )}
                  >
                    <span
                      className={cn(
                        'text-[9px] font-bold tabular-nums leading-none',
                        w.weight != null
                          ? w.isCurrentWeek
                            ? 'text-[#ffffff]'
                            : 'text-gray-600 dark:text-white/85'
                          : 'text-gray-400 dark:text-gray-500'
                      )}
                    >
                      {w.weight != null ? w.weight : '—'}
                    </span>
                    {w.weight != null && weekDeltas.get(w.weekStart) != null ? (
                      <span className="text-[7px] font-semibold tabular-nums text-[#6366f1]">
                        {weekDeltas.get(w.weekStart)! > 0 ? '+' : ''}
                        {weekDeltas.get(w.weekStart)}
                      </span>
                    ) : null}
                    <div
                      className={cn(
                        'w-full max-w-[1.35rem] rounded-t-sm transition-all duration-500',
                        w.weight == null && 'bg-gray-300/40 dark:bg-white/[0.08]'
                      )}
                      style={
                        w.weight != null
                          ? {
                              height: `${Math.max(4, Math.round((w.barPct / 100) * 40))}px`,
                              background: w.isCurrentWeek ? style.accent : `${style.accent}99`,
                              boxShadow: w.isCurrentWeek ? `0 0 8px ${style.glow}` : undefined,
                            }
                          : { height: '4px' }
                      }
                    />
                    <span className="max-w-full truncate text-[7px] font-semibold text-gray-500 dark:text-gray-400">
                      {w.weekIndex != null ? `W${w.weekIndex}` : w.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-1.5 text-center text-[9px] text-gray-500 dark:text-gray-400">
            {t('dashboard.weightFlipHint')}
          </p>
        </div>
      </div>
    </div>
  );
}
