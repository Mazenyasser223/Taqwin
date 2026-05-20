import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { FoodItem, FdcFoodPreview } from '../../types';
import { NUTRITION_MACRO_COLORS } from './nutritionMacroTheme';

export type NutritionFoodRow = {
  key: string;
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  subtitle?: string;
  imageUrl?: string;
  foodItem?: FoodItem;
  fdcPreview?: FdcFoodPreview;
};

type Props = {
  rows: NutritionFoodRow[];
  onLog: (row: NutritionFoodRow) => void;
  onDetails: (row: NutritionFoodRow) => void;
  onPrefetch?: (row: NutritionFoodRow) => void;
};

function formatMacroGrams(value: number): string {
  if (value > 0 && value < 0.1) return '<0.1';
  return value.toFixed(1);
}

export const NutritionFoodList: React.FC<Props> = ({ rows, onLog, onDetails, onPrefetch }) => {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-1 gap-4">
      {rows.map((row) => (
        <article
          key={row.key}
          className="glass-panel w-full rounded-3xl border border-subtle p-5 sm:p-6 flex flex-col gap-4 hover:border-accent/40 transition-colors group"
          onMouseEnter={() => onPrefetch?.(row)}
          onFocus={() => onPrefetch?.(row)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 text-start">
              <span className="inline-block text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 bg-accent/5 px-2.5 py-1 rounded-full border border-accent/10 mb-2">
                {row.category}
              </span>
              <h3 className="text-base sm:text-lg font-black text-foreground break-words leading-snug group-hover:text-accent transition-colors">
                {row.name}
              </h3>
              {row.subtitle && (
                <p className="text-[11px] text-faint mt-1.5 break-words line-clamp-2">{row.subtitle}</p>
              )}
              <p className="text-xs sm:text-sm text-muted mt-2.5 font-bold tracking-wide">
                {t('nutrition.per100g')}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onDetails(row)}
                disabled={!row.fdcPreview}
                className="size-11 rounded-xl bg-elevated border border-subtle text-foreground flex items-center justify-center hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
                aria-label={t('nutrition.details')}
              >
                <span className="material-symbols-outlined text-[22px]">info</span>
              </button>
              <button
                type="button"
                onClick={() => onLog(row)}
                className="size-11 rounded-xl bg-accent text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-accent/20"
                aria-label={t('nutrition.logMeal')}
              >
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                {
                  key: 'calories',
                  label: t('nutrition.macroCal'),
                  value: Math.round(row.calories),
                  suffix: '',
                  colorStyle: { color: NUTRITION_MACRO_COLORS.calories },
                },
                {
                  key: 'carbs',
                  label: t('nutrition.macroCarb'),
                  value: formatMacroGrams(row.carbs),
                  suffix: 'g',
                  colorStyle: { color: NUTRITION_MACRO_COLORS.carbs },
                },
                {
                  key: 'protein',
                  label: t('nutrition.macroProt'),
                  value: formatMacroGrams(row.protein),
                  suffix: 'g',
                  colorStyle: { color: NUTRITION_MACRO_COLORS.protein },
                },
                {
                  key: 'fat',
                  label: t('nutrition.macroFat'),
                  value: formatMacroGrams(row.fat),
                  suffix: 'g',
                  colorStyle: { color: NUTRITION_MACRO_COLORS.fat },
                },
              ] as const
            ).map((macro) => (
              <div
                key={macro.key}
                className="rounded-2xl bg-elevated/80 border border-subtle px-3 py-3.5 text-center"
              >
                <p className="text-xl sm:text-2xl font-black tabular-nums leading-none" style={macro.colorStyle}>
                  {macro.value}
                  {macro.suffix}
                </p>
                <p className="text-[11px] sm:text-xs font-bold text-muted mt-2 tracking-wide">{macro.label}</p>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
};
