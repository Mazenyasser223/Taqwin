import React, { useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import type { AthleteHomeDashboard } from '../../services/dashboardService';
import { computeFitnessScore } from './fitnessScore';
import {
  AVG_28_DAYS,
  HISTORY_DAYS,
  averageFitnessScoreHistory,
  buildFitnessScoreHistory,
} from './fitnessScoreHistory';
import { FitnessScoreHistoryModal } from './FitnessScoreHistoryModal';
import { useWellnessRevision } from './wellnessWidgets';

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

export function FitnessScoreKpiCard({
  data,
  userId,
  sleepPreference,
}: {
  data: AthleteHomeDashboard;
  userId?: string;
  sleepPreference?: string | null;
}) {
  const { t, language } = useI18n();
  const [touchFlipped, setTouchFlipped] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const wellnessRevision = useWellnessRevision();

  const style = {
    accent: BRAND,
    glow: 'rgba(21, 139, 141, 0.35)',
    border: 'border-[#158b8d]/25 dark:border-[#158b8d]/35',
    wash: 'from-[#158b8d]/18 via-[#158b8d]/5 to-transparent',
    iconFrom: 'from-[#158b8d]/45',
    iconTo: 'to-[#158b8d]/10',
  };

  const { score, pillars } = useMemo(
    () => computeFitnessScore(data, { userId, sleepPreference, t }),
    [data, userId, sleepPreference, t, wellnessRevision]
  );

  const pct = Math.min(100, Math.max(0, score));
  const flipActive = touchFlipped;
  const doneCount = pillars.filter((p) => p.met).length;
  const partialCount = pillars.filter((p) => p.progress > 0 && !p.met).length;

  const historyPoints = useMemo(
    () =>
      buildFitnessScoreHistory(data, {
        userId,
        sleepPreference,
        language,
        t,
        fullRange: true,
      }),
    [data, userId, sleepPreference, language, t, wellnessRevision, score]
  );

  const avg7 = useMemo(
    () =>
      averageFitnessScoreHistory(data, {
        userId,
        sleepPreference,
        language,
        t,
        days: HISTORY_DAYS,
      }),
    [data, userId, sleepPreference, language, t, wellnessRevision, score]
  );

  const avg28 = useMemo(
    () =>
      averageFitnessScoreHistory(data, {
        userId,
        sleepPreference,
        language,
        t,
        days: AVG_28_DAYS,
      }),
    [data, userId, sleepPreference, language, t, wellnessRevision, score]
  );

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
          setHistoryOpen(true);
        }}
        className="absolute end-5 top-5 z-20 flex size-11 items-center justify-center rounded-xl border border-subtle bg-elevated text-foreground transition-colors hover:border-accent/40 hover:text-accent dark:bg-white/[0.08]"
        aria-label={t('dashboard.fitnessHistoryInfo')}
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
        {/* Front */}
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
                monitoring
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
            {t('dashboard.fitnessScore')}
          </p>
          <p
            className="mt-1.5 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-[1.65rem]"
            style={{ textShadow: `0 0 40px ${style.glow}` }}
          >
            {score}%
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {partialCount > 0
              ? t('dashboard.fitnessScoreSubPartial', {
                  done: String(doneCount),
                  partial: String(partialCount),
                  total: '4',
                })
              : t('dashboard.fitnessScoreSub', { done: String(doneCount), total: '4' })}
          </p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-200/90 dark:bg-white/[0.08]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: style.accent, boxShadow: `0 0 12px ${style.glow}` }}
            />
          </div>
        </div>

        {/* Back — 2×2 pillar boxes */}
        <div className="absolute inset-0 flex flex-col justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="mb-2.5 text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400/90 sm:text-sm">
            {t('dashboard.fitnessFlipTitle')}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
            {pillars.map((pillar) => (
              <div
                key={pillar.id}
                className={cn(
                  'relative flex min-h-[5.25rem] flex-col items-center justify-center overflow-hidden rounded-xl border px-2 py-2.5 text-center sm:min-h-[5.5rem]',
                  pillar.met
                    ? 'border-brand-500/35 bg-brand-500/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : pillar.progress > 0
                      ? 'border-brand-500/20 bg-brand-500/[0.06] dark:bg-brand-500/10'
                      : 'border-gray-200/90 bg-white/50 dark:border-white/12 dark:bg-white/[0.05]'
                )}
              >
                {pillar.progress > 0 && !pillar.met ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 bg-brand-500/15 transition-all duration-500"
                    style={{ height: `${Math.round(pillar.progress * 100)}%` }}
                    aria-hidden
                  />
                ) : null}
                <span
                  className={cn(
                    'relative material-symbols-outlined text-[22px] leading-none sm:text-2xl',
                    pillar.met
                      ? 'text-brand-600 dark:text-brand-400'
                      : pillar.progress > 0
                        ? 'text-brand-500/80 dark:text-brand-400/80'
                        : 'text-gray-400 dark:text-gray-500'
                  )}
                >
                  {pillar.met ? 'check_circle' : pillar.icon}
                </span>
                <p className="mt-1.5 text-[11px] font-bold uppercase leading-snug text-gray-700 dark:text-gray-200 sm:text-xs">
                  {t(pillar.labelKey)}
                </p>
                <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-gray-500 dark:text-gray-400 sm:text-[11px]">
                  {pillar.detail}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-center text-[10px] text-gray-500 dark:text-gray-400 sm:text-xs">
            {t('dashboard.fitnessFlipHint')}
          </p>
        </div>
      </div>
    </div>

    <FitnessScoreHistoryModal
      open={historyOpen}
      onClose={() => setHistoryOpen(false)}
      points={historyPoints}
      avg7={avg7}
      avg28={avg28}
    />
    </>
  );
}
