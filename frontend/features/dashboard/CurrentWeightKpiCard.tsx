import React, { useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import type { AthleteHomeDashboard } from '../../services/dashboardService';
import {
  invalidateAthleteHomeCache,
  patchAthleteHomeAfterWeightLog,
  revalidateAthleteHomeInBackground,
} from '../../services/dashboardService';
import {
  WEIGHT_WINDOW_WEEKS,
  buildWeightWeekSeries,
  scaleWeightWeekBars,
  sliceWeightWeekWindow,
  weightDeltaVsLastWeek,
  weekOverWeekDeltas,
  labelWeightWeekWindow,
} from './weightHistory';
import {
  appendLocalWeightLog,
  mergeWeightLogs,
  parseServerWeightLog,
  readLocalWeightLog,
  removeLocalWeightLogForDate,
  resolveDisplayWeightKg,
  withProfileWeightBaseline,
} from './weightLogStore';
import { emitWeightLogChanged, useWeightLogRevision } from './wellnessWidgets';
import adaptationService from '../../services/adaptationService';

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
  programStartDate,
  onWeightLogged,
}: {
  data: AthleteHomeDashboard;
  userId?: string;
  bodyScore: number;
  /** Account signup date — anchors W1 and week-by-week chart. */
  programStartDate?: string | null;
  onWeightLogged?: (weightKg: number) => void;
}) {
  const { t, language } = useI18n();
  const weightRevision = useWeightLogRevision();
  const [touchFlipped, setTouchFlipped] = useState(false);
  const [weeksBack, setWeeksBack] = useState(0);
  const [logOpen, setLogOpen] = useState(false);
  const [logWeight, setLogWeight] = useState('');
  const [logError, setLogError] = useState<string | null>(null);

  const style = {
    accent: ACCENT,
    glow: 'rgba(99, 102, 241, 0.38)',
    border: 'border-[#6366f1]/25 dark:border-[#6366f1]/35',
    wash: 'from-[#6366f1]/22 via-[#6366f1]/6 to-transparent',
    iconFrom: 'from-[#6366f1]/50',
    iconTo: 'to-[#6366f1]/10',
  };

  const pct = Math.min(100, Math.max(0, bodyScore));
  const flipActive = touchFlipped;
  const today = data.today.date;

  const weightEntries = useMemo(() => {
    const server = parseServerWeightLog(data.analytics?.weightLog);
    const local = readLocalWeightLog(userId);
    const merged = mergeWeightLogs(server, local);
    return withProfileWeightBaseline(merged, data.profile.weight, today, programStartDate);
  }, [
    data.analytics?.weightLog,
    userId,
    data.profile.weight,
    today,
    programStartDate,
    weightRevision,
  ]);

  const currentWeightKg = useMemo(
    () => resolveDisplayWeightKg(weightEntries, data.profile.weight, today),
    [weightEntries, data.profile.weight, today]
  );

  const weightDisplay =
    currentWeightKg != null ? `${currentWeightKg} ${t('dashboard.kg')}` : '—';

  const weekDelta = useMemo(
    () => weightDeltaVsLastWeek(weightEntries, today, programStartDate),
    [weightEntries, today, programStartDate]
  );

  const sub =
    currentWeightKg == null
      ? t('dashboard.weightLogEmpty')
      : weekDelta == null
        ? t('dashboard.weightWeekOneHint')
        : weekDelta === 0
          ? t('dashboard.weightVsLastWeekSame')
          : t('dashboard.weightVsLastWeek', {
              delta: `${weekDelta > 0 ? '+' : ''}${weekDelta} ${t('dashboard.kg')}`,
            });

  const weightWeeks = useMemo(
    () => buildWeightWeekSeries(weightEntries, today, language, { programStartDate }),
    [weightEntries, today, language, programStartDate]
  );

  const { visible, weeksBack: clampedBack, maxWeeksBack } = useMemo(
    () => sliceWeightWeekWindow(weightWeeks, weeksBack),
    [weightWeeks, weeksBack]
  );

  const visibleLabeled = useMemo(() => labelWeightWeekWindow(visible), [visible]);

  const weekDeltas = useMemo(() => weekOverWeekDeltas(visibleLabeled), [visibleLabeled]);

  const trendBars = useMemo(() => scaleWeightWeekBars(visibleLabeled), [visibleLabeled]);
  const canGoBack = clampedBack < maxWeeksBack;
  const hasLoggedWeek = visible.some((w) => w.weight != null);

  const rangeLabel =
    visible.length > 0
      ? `${visible[0].label} – ${visible[visible.length - 1].label}`
      : null;

  const submitWeight = (w: number) => {
    const prevProfileWeight = data.profile.weight;
    setLogError(null);
    setLogOpen(false);
    setLogWeight('');

    if (userId) {
      appendLocalWeightLog(userId, today, w);
      patchAthleteHomeAfterWeightLog(w, today);
    }
    emitWeightLogChanged();
    onWeightLogged?.(w);

    void (async () => {
      try {
        await adaptationService.submitBodyMetric(w);
        revalidateAthleteHomeInBackground((fresh) => onWeightLogged?.(fresh.profile.weight ?? w));
      } catch (err) {
        if (userId) removeLocalWeightLogForDate(userId, today);
        invalidateAthleteHomeCache();
        emitWeightLogChanged();
        revalidateAthleteHomeInBackground((fresh) =>
          onWeightLogged?.(fresh.profile.weight ?? prevProfileWeight ?? w)
        );
        setLogError(err instanceof Error ? err.message : t('dashboard.weightSaveFailed'));
        setTouchFlipped(true);
        setLogOpen(true);
        setLogWeight(String(w));
      }
    })();
  };

  const logWeightControl = logOpen ? (
    <form
      className="mt-2 flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const w = Number(logWeight);
        if (!Number.isFinite(w) || w <= 0) return;
        submitWeight(w);
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-2">
        <input
          type="number"
          step="0.1"
          min="1"
          max="400"
          value={logWeight}
          onChange={(e) => setLogWeight(e.target.value)}
          placeholder={t('dashboard.kg')}
          className="min-w-0 flex-1 rounded-lg border border-subtle bg-elevated px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-[#6366f1] px-3 py-1.5 text-xs font-bold text-white"
        >
          {t('common.save')}
        </button>
      </div>
      {logError ? <p className="text-[10px] font-medium text-red-500">{logError}</p> : null}
    </form>
  ) : (
    <button
      type="button"
      className="mt-1 block w-full text-left text-xs font-semibold text-[#6366f1] hover:text-[#818cf8] transition-colors py-0.5"
      onClick={(e) => {
        e.stopPropagation();
        setLogError(null);
        setTouchFlipped(true);
        setLogOpen(true);
        setLogWeight(currentWeightKg != null ? String(currentWeightKg) : '');
      }}
    >
      {t('dashboard.logWeight')}
    </button>
  );

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
          'relative z-[1] min-h-[128px] transition-transform duration-500 [transform-style:preserve-3d]',
          flipActive && '[transform:rotateY(180deg)]',
          '[@media(hover:hover)]:group-hover:[transform:rotateY(180deg)]'
        )}
      >
        <div
          className={cn(
            '[backface-visibility:hidden]',
            flipActive && 'pointer-events-none',
            '[@media(hover:hover)]:group-hover:pointer-events-none'
          )}
        >
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

        <div
          className={cn(
            'absolute inset-0 flex flex-col gap-1 [backface-visibility:hidden] [transform:rotateY(180deg)]',
            'pointer-events-none',
            flipActive && 'pointer-events-auto',
            '[@media(hover:hover)]:group-hover:pointer-events-auto'
          )}
        >
          {clampedBack > 0 && rangeLabel ? (
            <p className="shrink-0 text-center text-[9px] font-semibold tabular-nums text-muted">{rangeLabel}</p>
          ) : null}

          {!hasLoggedWeek && weightEntries.length === 0 ? (
            <p className="shrink-0 px-1 text-center text-xs text-muted">{t('dashboard.weightLogEmpty')}</p>
          ) : (
            <div className="flex shrink-0 items-stretch gap-1.5" dir="ltr">
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

              <div
                className="relative flex h-[68px] min-w-0 flex-1 items-end justify-between gap-1 rounded-lg border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent px-1.5 pb-1 pt-1.5 dark:from-white/[0.02]"
                role="img"
                aria-label={t('dashboard.currentWeight')}
              >
                <div
                  className="pointer-events-none absolute inset-x-1.5 bottom-[14px] border-t border-dashed border-white/10 dark:border-white/[0.12]"
                  aria-hidden
                />
                {trendBars.map((w) => {
                  const barHeightPx =
                    w.weight != null ? Math.max(22, Math.round((w.barPct / 100) * 44)) : 8;
                  const delta = weekDeltas.get(w.weekStart);
                  return (
                    <div
                      key={w.weekStart}
                      className="flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5"
                    >
                      <div className="flex min-h-[12px] flex-col items-center justify-end leading-none">
                        <span
                          className={cn(
                            'text-[9px] font-bold tabular-nums',
                            w.weight != null
                              ? w.isCurrentWeek
                                ? 'text-white'
                                : 'text-gray-700 dark:text-white/90'
                              : 'text-gray-400 dark:text-gray-500'
                          )}
                        >
                          {w.weight != null ? w.weight : '—'}
                        </span>
                        {w.weight != null && delta != null ? (
                          <span
                            className={cn(
                              'text-[7px] font-semibold tabular-nums',
                              delta > 0
                                ? 'text-amber-500/90'
                                : delta < 0
                                  ? 'text-emerald-400/90'
                                  : 'text-[#6366f1]/80'
                            )}
                          >
                            {delta > 0 ? '+' : ''}
                            {delta}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex h-[44px] w-full max-w-[2rem] items-end justify-center">
                        <div
                          className={cn(
                            'relative w-[72%] min-w-[8px] max-w-[1.5rem] transition-all duration-500 ease-out',
                            w.weight == null
                              ? 'rounded-t-md bg-gray-300/30 dark:bg-white/[0.07]'
                              : 'rounded-t-md',
                            w.isCurrentWeek &&
                              w.weight != null &&
                              'ring-1 ring-[#6366f1]/50 ring-offset-1 ring-offset-transparent'
                          )}
                          style={
                            w.weight != null
                              ? {
                                  height: `${barHeightPx}px`,
                                  background: w.isCurrentWeek
                                    ? `linear-gradient(180deg, #818cf8 0%, ${style.accent} 55%, #4f46e5 100%)`
                                    : `linear-gradient(180deg, ${style.accent}cc 0%, ${style.accent}88 100%)`,
                                  boxShadow: w.isCurrentWeek
                                    ? `0 -6px 16px ${style.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`
                                    : `0 -2px 8px ${style.glow}66`,
                                }
                              : { height: `${barHeightPx}px` }
                          }
                        >
                          {w.weight != null ? (
                            <span
                              className="pointer-events-none absolute inset-x-0 top-0 h-[35%] rounded-t-md bg-white/20"
                              aria-hidden
                            />
                          ) : null}
                        </div>
                      </div>
                      <span className="max-w-full truncate text-[7px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {w.weekIndex != null ? `W${w.weekIndex}` : w.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="relative z-[2] mt-auto shrink-0 pt-1">
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{sub}</p>
            {logWeightControl}
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-200/90 dark:bg-white/[0.08]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: style.accent, boxShadow: `0 0 12px ${style.glow}` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
