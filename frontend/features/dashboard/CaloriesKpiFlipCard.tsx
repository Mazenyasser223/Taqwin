import React, { useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import type { AthleteHomeDashboard } from '../../services/dashboardService';
import { TodayNutritionDetailsModal } from './TodayNutritionDetailsModal';
import { NUTRITION_MACRO_COLORS } from '../nutrition/nutritionMacroTheme';

const ACCENT = '#f37021';

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

export function CaloriesKpiFlipCard({
  data,
  calorieAdherence,
}: {
  data: AthleteHomeDashboard;
  calorieAdherence: number;
}) {
  const { t } = useI18n();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [touchFlipped, setTouchFlipped] = useState(false);

  const style = {
    accent: ACCENT,
    glow: 'rgba(243, 112, 33, 0.38)',
    border: 'border-[#f37021]/25 dark:border-[#f37021]/35',
    wash: 'from-[#f37021]/20 via-[#f37021]/6 to-transparent',
    iconFrom: 'from-[#f37021]/50',
    iconTo: 'to-[#f37021]/10',
  };

  const calories = data.today.nutrition.calories;
  const protein = Math.round(data.today.nutrition.protein);
  const carbs = Math.round(data.today.nutrition.carbs);
  const fat = Math.round(data.today.nutrition.fat);
  const proteinTarget = Math.round(data.targets.proteinTarget);
  const carbTarget = Math.round(data.targets.carbTarget);
  const fatTarget = Math.round(data.targets.fatTarget);
  const macroRows = [
    {
      label: t('nutrition.macroProt'),
      g: protein,
      target: proteinTarget,
      key: 'p' as const,
      color: NUTRITION_MACRO_COLORS.protein,
    },
    {
      label: t('nutrition.macroCarb'),
      g: carbs,
      target: carbTarget,
      key: 'c' as const,
      color: NUTRITION_MACRO_COLORS.carbs,
    },
    {
      label: t('nutrition.macroFat'),
      g: fat,
      target: fatTarget,
      key: 'f' as const,
      color: NUTRITION_MACRO_COLORS.fat,
    },
  ];
  const pct = Math.max(0, calorieAdherence);
  const pctDisplay = Math.round(pct);
  const pctVisual = Math.min(100, pct);
  const flipActive = touchFlipped;

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
          aria-label={t('nutrition.details')}
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
                  local_fire_department
                </span>
              </div>
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                <MiniProgressRing percent={pctVisual} color={style.accent} />
                <span
                  className={cn(
                    'absolute inset-0 flex items-center justify-center font-bold tabular-nums',
                    pctDisplay >= 100 ? 'text-[9px]' : 'text-[10px]'
                  )}
                  style={{ color: style.accent }}
                >
                  {pctDisplay}
                </span>
              </div>
            </div>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400/90">
              {t('dashboard.caloriesToday')}
            </p>
            <p
              className="mt-1.5 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-[1.65rem]"
              style={{ textShadow: `0 0 40px ${style.glow}` }}
            >
              {calories}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {pctDisplay}% · {data.targets.calorieTarget} {t('dashboard.targetWord')}
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-200/90 dark:bg-white/[0.08]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pctVisual}%`,
                  background: style.accent,
                  boxShadow: `0 0 12px ${style.glow}`,
                }}
              />
            </div>
          </div>

          <div className="absolute inset-0 flex flex-col justify-center gap-2 pe-14 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {macroRows.map((row) => {
              const macroPct =
                row.target > 0 ? Math.max(0, Math.round((row.g / row.target) * 100)) : 0;
              const macroPctVisual = Math.min(100, macroPct);
              const barWidth = Math.max(macroPctVisual, macroPctVisual > 0 ? 6 : 0);
              return (
                <div key={row.key} className="leading-tight">
                  <div className="mb-px flex items-center justify-between gap-1.5">
                    <span
                      className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide"
                      style={{ color: row.color }}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: row.color, boxShadow: `0 0 6px ${row.color}88` }}
                      />
                      {row.label}
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                      {t('dashboard.macroOfTarget', {
                        current: String(row.g),
                        target: String(row.target),
                      })}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-200/90 dark:bg-white/[0.08]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barWidth}%`,
                        background: row.color,
                        boxShadow: `0 0 10px ${row.color}55`,
                      }}
                    />
                  </div>
                  <p className="mt-px text-xs font-bold tabular-nums leading-none" style={{ color: row.color }}>
                    {macroPct}%
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <TodayNutritionDetailsModal open={detailsOpen} onClose={() => setDetailsOpen(false)} data={data} />
    </>
  );
}
