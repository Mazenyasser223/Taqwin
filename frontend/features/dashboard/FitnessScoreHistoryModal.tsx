import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import {
  HISTORY_DAYS,
  formatChartDateLabel,
  sliceFitnessScoreWindow,
  type FitnessScoreHistoryPoint,
} from './fitnessScoreHistory';
import type { TranslationKey } from '../../lib/i18n/translations';
import type { AppLanguage } from '../../services/settingsService';

const BRAND = '#158b8d';
const GLOW = 'rgba(21, 139, 141, 0.35)';

function FitnessScoreChartTooltip({
  active,
  payload,
  t,
  language,
}: {
  active?: boolean;
  payload?: Array<{ payload?: FitnessScoreHistoryPoint }>;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
  language: AppLanguage;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="min-w-[200px] max-w-[240px] rounded-xl border border-brand-500/30 bg-white/98 px-3 py-2.5 shadow-xl dark:border-brand-500/40 dark:bg-[#121a28]/98">
      <p className="text-[11px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">
        {formatChartDateLabel(point.date, language)}
      </p>
      <p className="mt-0.5 text-base font-extrabold tabular-nums text-brand-600 dark:text-brand-400">
        {point.score}%{' '}
        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{t('dashboard.fitnessScore')}</span>
      </p>
      <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-gray-400">
        {t('dashboard.fitnessHistoryWhy')}
      </p>
      <ul className="mt-1.5 space-y-2">
        {point.pillars.map((pillar) => (
          <li key={pillar.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                <span className="material-symbols-outlined text-[14px] text-brand-600/80 dark:text-brand-400/80">
                  {pillar.icon}
                </span>
                {t(pillar.labelKey)}
              </span>
              <span
                className={cn(
                  'shrink-0 text-[11px] font-extrabold tabular-nums',
                  pillar.met
                    ? 'text-brand-600 dark:text-brand-400'
                    : pillar.progress > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-gray-400'
                )}
              >
                {Math.round(pillar.points)}/25
              </span>
            </div>
            <p className="mt-0.5 ps-5 text-[10px] leading-snug text-gray-500 dark:text-gray-400">{pillar.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NavButton({
  onClick,
  disabled,
  ariaLabel,
  children,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg border border-subtle bg-elevated text-faint transition-colors',
        'hover:border-brand-500/35 hover:text-brand-600 dark:hover:text-brand-400',
        'disabled:pointer-events-none disabled:opacity-35',
        className
      )}
    >
      {children}
    </button>
  );
}

export function FitnessScoreHistoryModal({
  open,
  onClose,
  points,
  avg7,
  avg28,
}: {
  open: boolean;
  onClose: () => void;
  points: FitnessScoreHistoryPoint[];
  avg7: number;
  avg28: number;
}) {
  const { t, dir, language } = useI18n();
  const [daysBack, setDaysBack] = useState(0);

  const { visible, daysBack: clampedBack, maxDaysBack } = useMemo(
    () => sliceFitnessScoreWindow(points, { daysBack, language, t }),
    [points, daysBack, language, t]
  );

  const atPresent = clampedBack === 0;
  const canGoBack = clampedBack < maxDaysBack;
  const canGoForward = clampedBack > 0;
  const backIcon = 'chevron_left';
  const forwardIcon = 'chevron_right';

  useEffect(() => {
    if (!open) setDaysBack(0);
  }, [open]);

  if (typeof document === 'undefined') return null;

  const latest = points.length > 0 ? points[points.length - 1].score : 0;
  const rangeLabel =
    visible.length > 0
      ? visible.length === 1
        ? visible[0].date
        : `${visible[0].date} – ${visible[visible.length - 1].date}`
      : '';

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[210] flex items-end justify-center bg-background/95 p-0 backdrop-blur-md sm:items-center sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'glass-panel flex w-full max-h-[min(90vh,600px)] flex-col',
              'overflow-y-auto overflow-x-hidden',
              'rounded-t-3xl border border-subtle shadow-2xl sm:max-w-[580px] sm:rounded-3xl',
              'border-[#158b8d]/25 dark:border-[#158b8d]/35'
            )}
            style={{
              boxShadow: `0 8px 32px -8px ${GLOW}, inset 0 1px 0 rgba(255,255,255,0.12)`,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="fitness-history-title"
            dir={dir}
          >
            <div className="relative border-b border-subtle bg-gradient-to-br from-[#158b8d]/18 via-[#158b8d]/5 to-transparent px-5 py-4">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#158b8d]/30 opacity-50 blur-2xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0 text-start">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-600/90 dark:text-brand-400/90">
                    {t('dashboard.fitnessScore')}
                  </p>
                  <h3
                    id="fitness-history-title"
                    className="mt-1 text-lg font-black leading-snug text-foreground sm:text-xl"
                  >
                    {t('dashboard.fitnessHistoryTitle')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="ms-auto flex size-10 shrink-0 items-center justify-center rounded-xl border border-subtle bg-elevated text-faint transition-colors hover:text-foreground"
                  aria-label={t('common.close')}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-4 p-5 sm:p-6">
              <div className="grid shrink-0 grid-cols-3 gap-2">
                <div className="rounded-xl border border-brand-500/25 bg-brand-500/10 px-2 py-2.5 text-center sm:px-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:text-[10px]">
                    {t('dashboard.fitnessHistoryLatest')}
                  </p>
                  <p className="mt-1 text-xl font-extrabold tabular-nums text-brand-600 dark:text-brand-400 sm:text-2xl">
                    {latest}%
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200/90 bg-white/50 px-2 py-2.5 text-center dark:border-white/12 dark:bg-white/[0.05] sm:px-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:text-[10px]">
                    {t('dashboard.fitnessHistoryAvgLabel')}
                  </p>
                  <p className="mt-1 text-xl font-extrabold tabular-nums text-gray-900 dark:text-white sm:text-2xl">
                    {avg7}%
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200/90 bg-white/50 px-2 py-2.5 text-center dark:border-white/12 dark:bg-white/[0.05] sm:px-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 sm:text-[10px]">
                    {t('dashboard.fitnessHistoryAvg28Label')}
                  </p>
                  <p className="mt-1 text-xl font-extrabold tabular-nums text-gray-900 dark:text-white sm:text-2xl">
                    {avg28}%
                  </p>
                </div>
              </div>

              <div className="shrink-0 rounded-xl border border-gray-200/90 bg-white/50 p-2 dark:border-white/12 dark:bg-white/[0.03]">
                {points.length === 0 ? (
                  <p className="flex h-[300px] items-center justify-center px-4 text-center text-sm text-muted">
                    {t('dashboard.fitnessHistoryEmpty')}
                  </p>
                ) : (
                  <>
                    {!atPresent && rangeLabel ? (
                      <p className="mb-2 text-center text-[10px] font-semibold tabular-nums text-muted">
                        {rangeLabel}
                      </p>
                    ) : null}
                    <div className="flex items-stretch gap-1" dir="ltr">
                      <div className="flex shrink-0 flex-col justify-center gap-1">
                        <NavButton
                          onClick={() => setDaysBack((prev) => Math.min(prev + 1, maxDaysBack))}
                          disabled={!canGoBack}
                          ariaLabel={t('dashboard.fitnessHistoryBackDay')}
                        >
                          <span className="material-symbols-outlined text-[22px]">{backIcon}</span>
                        </NavButton>
                        <NavButton
                          onClick={() => setDaysBack((prev) => Math.min(prev + HISTORY_DAYS, maxDaysBack))}
                          disabled={!canGoBack}
                          ariaLabel={t('dashboard.fitnessHistoryBackWeek')}
                          className="flex-col gap-0 py-1"
                        >
                          <span className="material-symbols-outlined text-[18px] leading-none">{backIcon}</span>
                          <span className="text-[8px] font-bold uppercase leading-none tracking-wide">7d</span>
                        </NavButton>
                      </div>

                      <div className="h-[300px] min-h-[300px] flex-1 [&_.recharts-wrapper]:!overflow-visible [&_.recharts-surface]:overflow-visible">
                        <ResponsiveContainer width="100%" height={300} debounce={50}>
                          <AreaChart
                            data={visible}
                            margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="fitnessScoreHistoryFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={BRAND} stopOpacity={0.4} />
                                <stop offset="100%" stopColor={BRAND} stopOpacity={0.04} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="currentColor"
                              className="text-gray-200/80 dark:text-white/10"
                            />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 9, fill: '#9ca3af' }}
                              interval={0}
                              angle={atPresent ? 0 : -35}
                              textAnchor={atPresent ? 'middle' : 'end'}
                              tickLine={false}
                              axisLine={false}
                              height={atPresent ? 24 : 44}
                            />
                            <YAxis
                              domain={[0, 100]}
                              tick={{ fontSize: 10, fill: '#9ca3af' }}
                              tickLine={false}
                              axisLine={false}
                              width={28}
                              tickFormatter={(v) => `${v}`}
                            />
                            <Tooltip
                              content={
                                <FitnessScoreChartTooltip t={t} language={language} />
                              }
                              cursor={{ stroke: 'rgba(255,255,255,0.35)', strokeWidth: 1 }}
                            />
                            <Area
                              type="monotone"
                              dataKey="score"
                              stroke={BRAND}
                              strokeWidth={2.5}
                              fill="url(#fitnessScoreHistoryFill)"
                              dot={{ r: 3, fill: BRAND, strokeWidth: 0 }}
                              activeDot={{ r: 5, fill: BRAND, stroke: '#fff', strokeWidth: 2 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="flex shrink-0 flex-col justify-center gap-1">
                        <NavButton
                          onClick={() => setDaysBack((prev) => Math.max(0, prev - 1))}
                          disabled={!canGoForward}
                          ariaLabel={t('dashboard.fitnessHistoryForwardDay')}
                        >
                          <span className="material-symbols-outlined text-[22px]">{forwardIcon}</span>
                        </NavButton>
                        <NavButton
                          onClick={() => setDaysBack((prev) => Math.max(0, prev - HISTORY_DAYS))}
                          disabled={!canGoForward}
                          ariaLabel={t('dashboard.fitnessHistoryForwardWeek')}
                          className="flex-col gap-0 py-1"
                        >
                          <span className="material-symbols-outlined text-[18px] leading-none">{forwardIcon}</span>
                          <span className="text-[8px] font-bold uppercase leading-none tracking-wide">7d</span>
                        </NavButton>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
