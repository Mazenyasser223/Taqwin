import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useI18n } from '../../lib/i18n/useI18n';
import { cn } from '../../lib/cn';
import type { TranslationKey } from '../../lib/i18n/translations';
import {
  CALORIE_WINDOW_DAYS,
  sliceCalorieWindow,
  type CalorieHistoryPoint,
} from './calorieHistory';

const ACCENT = '#f37021';

function CalorieChartTooltip({
  active,
  payload,
  t,
}: {
  active?: boolean;
  payload?: Array<{ payload?: CalorieHistoryPoint }>;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="min-w-[168px] rounded-xl border border-white/15 bg-gray-950/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
      <p className="text-[11px] font-semibold tabular-nums text-white/90">{point.date}</p>
      <p className="mt-0.5 text-base font-extrabold tabular-nums text-[#ffffff]">
        {point.calories.toLocaleString()} {t('dashboard.calorieHistoryKcal')}
      </p>
      <p className="mt-1 text-[10px] text-white/90">
        {t('dashboard.calorieHistoryOfTarget', {
          pct: String(point.pct),
          target: String(Math.round(point.target)),
        })}
      </p>
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
        'hover:border-[#f37021]/35 hover:text-[#f37021]',
        'disabled:pointer-events-none disabled:opacity-35',
        className
      )}
    >
      {children}
    </button>
  );
}

export function CalorieHistoryChart({
  points,
  target,
  selectedDate,
  onSelectDay,
}: {
  points: CalorieHistoryPoint[];
  target: number;
  selectedDate?: string | null;
  onSelectDay?: (point: CalorieHistoryPoint) => void;
}) {
  const { t, language } = useI18n();
  const [daysBack, setDaysBack] = useState(0);

  const { visible, daysBack: clampedBack, maxDaysBack } = useMemo(
    () => sliceCalorieWindow(points, { daysBack, language, t }),
    [points, daysBack, language, t]
  );

  const atPresent = clampedBack === 0;
  const canGoBack = clampedBack < maxDaysBack;
  const canGoForward = clampedBack > 0;

  const maxVal = Math.max(target, ...visible.map((p) => p.calories), 1);
  const yMax = Math.ceil(maxVal * 1.15);

  if (points.length === 0) {
    return (
      <p className="flex h-[260px] items-center justify-center text-center text-sm text-muted">
        {t('dashboard.calorieHistoryEmpty')}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {!atPresent && visible.length > 0 ? (
        <p className="text-center text-[10px] font-semibold tabular-nums text-muted">
          {visible.length === 1
            ? visible[0].date
            : `${visible[0].date} – ${visible[visible.length - 1].date}`}
        </p>
      ) : null}
      <div className="flex items-stretch gap-1" dir="ltr">
        <div className="flex shrink-0 flex-col justify-center gap-1">
          <NavButton
            onClick={() => setDaysBack((prev) => Math.min(prev + 1, maxDaysBack))}
            disabled={!canGoBack}
            ariaLabel={t('dashboard.fitnessHistoryBackDay')}
          >
            <span className="material-symbols-outlined text-[22px]">chevron_left</span>
          </NavButton>
          <NavButton
            onClick={() => setDaysBack((prev) => Math.min(prev + CALORIE_WINDOW_DAYS, maxDaysBack))}
            disabled={!canGoBack}
            ariaLabel={t('dashboard.fitnessHistoryBackWeek')}
            className="flex-col gap-0 py-1"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">chevron_left</span>
            <span className="text-[8px] font-bold uppercase leading-none tracking-wide">7d</span>
          </NavButton>
        </div>

        <div className="h-[260px] min-h-[260px] flex-1">
          <ResponsiveContainer width="100%" height={260} debounce={50}>
            <BarChart
              data={visible}
              margin={{ top: 12, right: 8, left: 0, bottom: atPresent ? 2 : 10 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-gray-200/80 dark:text-white/10"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{
                  fontSize: 9,
                  fill: '#9ca3af',
                  dy: atPresent ? 0 : 6,
                }}
                interval={0}
                angle={atPresent ? 0 : -35}
                textAnchor={atPresent ? 'middle' : 'end'}
                tickMargin={atPresent ? 4 : 8}
                tickLine={false}
                axisLine={false}
                height={atPresent ? 24 : 48}
              />
              <YAxis
                domain={[0, yMax]}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip content={<CalorieChartTooltip t={t} />} cursor={{ fill: 'rgba(243,112,33,0.08)' }} />
              {target > 0 ? (
                <ReferenceLine
                  y={target}
                  stroke={ACCENT}
                  strokeDasharray="4 4"
                  strokeOpacity={0.65}
                  label={{
                    value: t('dashboard.calorieHistoryTarget'),
                    position: 'insideTopRight',
                    fill: '#9ca3af',
                    fontSize: 9,
                  }}
                />
              ) : null}
              <Bar
                dataKey="calories"
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
                cursor="pointer"
                onClick={(bar) => {
                  const point = bar as CalorieHistoryPoint;
                  if (point?.date) onSelectDay?.(point);
                }}
              >
                {visible.map((entry) => {
                  const isSelected = selectedDate === entry.date;
                  return (
                    <Cell
                      key={entry.date}
                      fill={
                        entry.calories >= entry.target
                          ? isSelected
                            ? ACCENT
                            : '#f59e0b'
                          : isSelected
                            ? ACCENT
                            : 'rgba(243, 112, 33, 0.55)'
                      }
                      stroke={isSelected ? '#fff' : 'none'}
                      strokeWidth={isSelected ? 2 : 0}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex shrink-0 flex-col justify-center gap-1">
          <NavButton
            onClick={() => setDaysBack((prev) => Math.max(0, prev - 1))}
            disabled={!canGoForward}
            ariaLabel={t('dashboard.fitnessHistoryForwardDay')}
          >
            <span className="material-symbols-outlined text-[22px]">chevron_right</span>
          </NavButton>
          <NavButton
            onClick={() => setDaysBack((prev) => Math.max(0, prev - CALORIE_WINDOW_DAYS))}
            disabled={!canGoForward}
            ariaLabel={t('dashboard.fitnessHistoryForwardWeek')}
            className="flex-col gap-0 py-1"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">chevron_right</span>
            <span className="text-[8px] font-bold uppercase leading-none tracking-wide">7d</span>
          </NavButton>
        </div>
      </div>
    </div>
  );
}
