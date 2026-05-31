import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import type { AthleteHomeDashboard } from '../../services/dashboardService';
import type { FdcNutrientRow } from '../../types';
import { NutrientTable } from '../nutrition/NutritionDetailsModal';
import { NutritionMacroDonut } from '../nutrition/NutritionMacroDonut';
import {
  macroProgressFillBackground,
  NUTRITION_MACRO_COLORS,
} from '../nutrition/nutritionMacroTheme';
import {
  averageCalories,
  buildCalorieHistory,
  CALORIE_WINDOW_DAYS,
  formatCalorieDayHeading,
  type CalorieHistoryPoint,
} from './calorieHistory';
import { CalorieHistoryChart } from './CalorieHistoryChart';

type TodayMicronutrients = NonNullable<
  NonNullable<AthleteHomeDashboard['analytics']>['todayMicronutrients']
>;

function toNutrientRows(
  items: Array<{ name: string; amount: number; unit: string; display: string }>
): FdcNutrientRow[] {
  return items.map((row) => ({
    id: null,
    name: row.name,
    amount: row.amount,
    unit: row.unit,
    display: row.display,
  }));
}

type Props = {
  open: boolean;
  onClose: () => void;
  data: AthleteHomeDashboard;
};

export const TodayNutritionDetailsModal: React.FC<Props> = ({ open, onClose, data }) => {
  const { t, dir, language, isRtl } = useI18n();

  const micronutrients: TodayMicronutrients | undefined = data.analytics?.todayMicronutrients;

  const vitamins = micronutrients ? toNutrientRows(micronutrients.vitamins) : [];
  const minerals = micronutrients ? toNutrientRows(micronutrients.minerals) : [];
  const nutrients = micronutrients ? toNutrientRows(micronutrients.nutrients) : [];
  const hasMicronutrients = vitamins.length + minerals.length + nutrients.length > 0;

  const calorieHistory = useMemo(() => buildCalorieHistory(data, t), [data, t]);
  const calorieAvg = useMemo(
    () => averageCalories(calorieHistory.slice(-CALORIE_WINDOW_DAYS)),
    [calorieHistory]
  );
  const calorieTarget = data.targets.calorieTarget;
  const [selectedDay, setSelectedDay] = useState<CalorieHistoryPoint | null>(null);

  useEffect(() => {
    if (!open) setSelectedDay(null);
  }, [open]);

  const todayDate = data.today.date;
  const activeNutrition = selectedDay
    ? {
        calories: selectedDay.calories,
        protein: selectedDay.protein,
        carbs: selectedDay.carbs,
        fat: selectedDay.fat,
        logCount: selectedDay.logCount,
      }
    : data.today.nutrition;
  const { protein, carbs, fat, calories } = activeNutrition;
  const showTodayMicronutrients = !selectedDay || selectedDay.date === todayDate;
  const loggedMacroHeading =
    selectedDay && selectedDay.date !== todayDate
      ? t('dashboard.macroDistributionLoggedDay')
      : t('dashboard.macroDistributionLogged');

  const modalTitle = formatCalorieDayHeading(
    selectedDay?.date ?? todayDate,
    todayDate,
    language,
    t
  );

  const modalSubtitle = selectedDay
    ? t('dashboard.calorieHistoryDaySummary', {
        calories: selectedDay.calories.toLocaleString(),
        pct: String(selectedDay.pct),
        target: String(Math.round(selectedDay.target)),
      })
    : t('dashboard.todayNutritionSubtitle', {
        logs: String(activeNutrition.logCount),
        target: String(data.targets.calorieTarget),
      });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-background/95 p-0 sm:p-6 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full sm:max-w-5xl max-h-[92vh] sm:max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-subtle p-6 sm:p-8 space-y-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="today-nutrition-details-title"
            dir={dir}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-start">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 mb-1">
                  {t('nutrition.details')}
                </p>
                <h3
                  id="today-nutrition-details-title"
                  className="text-xl font-black text-foreground break-words leading-snug"
                >
                  {modalTitle}
                </h3>
                <p className="text-xs text-faint mt-1.5">{modalSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 size-10 rounded-xl bg-elevated border border-subtle flex items-center justify-center text-faint hover:text-foreground"
                aria-label={t('common.cancel')}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <NutritionMacroDonut
                    protein={protein}
                    carbs={carbs}
                    fat={fat}
                    calories={calories}
                    heading={loggedMacroHeading}
                    compact
                  />
                  <NutritionMacroDonut
                    protein={data.targets.proteinTarget}
                    carbs={data.targets.carbTarget}
                    fat={data.targets.fatTarget}
                    calories={data.targets.calorieTarget}
                    heading={t('dashboard.macroDistributionAi')}
                    compact
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        label: t('dashboard.macroProtein'),
                        g: Math.round(protein),
                        target: data.targets.proteinTarget,
                        key: 'p' as const,
                        color: NUTRITION_MACRO_COLORS.protein,
                      },
                      {
                        label: t('dashboard.macroCarbs'),
                        g: Math.round(carbs),
                        target: data.targets.carbTarget,
                        key: 'c' as const,
                        color: NUTRITION_MACRO_COLORS.carbs,
                      },
                      {
                        label: t('dashboard.macroFat'),
                        g: Math.round(fat),
                        target: data.targets.fatTarget,
                        key: 'f' as const,
                        color: NUTRITION_MACRO_COLORS.fat,
                      },
                    ] as const
                  ).map((row) => {
                    const targetG = Math.round(row.target);
                    const pct =
                      row.target > 0 ? Math.max(0, Math.round((row.g / row.target) * 100)) : 0;
                    const fillWidth = Math.max(Math.min(100, pct), pct > 0 ? 8 : 0);
                    return (
                      <div
                        key={row.key}
                        className="relative overflow-hidden rounded-xl border border-subtle min-h-[8.5rem] transition-[background] duration-500"
                        style={{
                          background: macroProgressFillBackground(row.color, fillWidth, isRtl),
                          borderColor: `${row.color}33`,
                        }}
                      >
                        <div className="relative flex flex-col items-center justify-center px-2 py-3 text-center h-full min-h-[8.5rem]">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-faint truncate w-full">
                            {row.label}
                          </p>
                          <p className="text-lg font-black tabular-nums text-foreground leading-tight mt-0.5">
                            {row.g}g
                          </p>
                          <p className="text-xs font-semibold tabular-nums text-foreground/80 mt-1">
                            {t('dashboard.macroOfTarget', {
                              current: String(row.g),
                              target: String(targetG),
                            })}
                          </p>
                          <p
                            className="text-xs font-bold tabular-nums mt-1.5"
                            style={{ color: row.color }}
                          >
                            {pct}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {showTodayMicronutrients &&
                micronutrients &&
                micronutrients.totals.trackedFoods > 0 ? (
                  <p className="text-[11px] text-faint text-center lg:text-start">
                    {t('dashboard.micronutrientsFromLogs', {
                      count: String(micronutrients.totals.trackedFoods),
                    })}
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-[#f37021]/20 bg-[#f37021]/[0.06] p-4 dark:bg-[#f37021]/10">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#f37021]/90">
                      {t('dashboard.calorieHistoryTitle')}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{t('dashboard.calorieHistorySubtitle')}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-muted">
                      {selectedDay ? t('dashboard.calorieHistorySelected') : t('dashboard.calorieHistoryAvg')}
                    </p>
                    <p className="text-lg font-extrabold tabular-nums text-[#f37021]">
                      {selectedDay
                        ? selectedDay.calories.toLocaleString()
                        : calorieAvg.toLocaleString()}
                    </p>
                  </div>
                </div>
                <CalorieHistoryChart
                  points={calorieHistory}
                  target={calorieTarget}
                  selectedDate={selectedDay?.date}
                  onSelectDay={setSelectedDay}
                />
                <p className="mt-2 text-center text-[10px] text-muted lg:text-start">
                  {t('dashboard.calorieHistoryTargetLine', {
                    target: String(Math.round(calorieTarget)),
                  })}
                </p>
              </div>
            </div>

            <div className="space-y-5 border-t border-subtle pt-5">
              {showTodayMicronutrients ? (
                <>
                  <NutrientTable
                    title={t('nutrition.detailsVitamins')}
                    rows={vitamins}
                    nutrientCol={t('nutrition.detailsNutrientCol')}
                    amountCol={t('nutrition.detailsAmountCol')}
                    language={language}
                  />
                  <NutrientTable
                    title={t('nutrition.detailsMinerals')}
                    rows={minerals}
                    nutrientCol={t('nutrition.detailsNutrientCol')}
                    amountCol={t('nutrition.detailsAmountCol')}
                    language={language}
                  />
                  <NutrientTable
                    title={t('nutrition.detailsNutrients')}
                    rows={nutrients}
                    nutrientCol={t('nutrition.detailsNutrientCol')}
                    amountCol={t('nutrition.detailsAmountCol')}
                    language={language}
                  />
                  {!hasMicronutrients && (
                    <p className="text-xs text-faint text-center py-2">
                      {activeNutrition.logCount > 0
                        ? t('dashboard.micronutrientsEmpty')
                        : t('nutrition.detailsNoExtra')}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-faint text-center py-2">
                  {t('dashboard.micronutrientsHistoricalHint')}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
