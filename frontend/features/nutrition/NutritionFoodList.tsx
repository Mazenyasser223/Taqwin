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
    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
      {rows.map((row) => {
        const canOpenDetails = Boolean(row.fdcPreview || row.foodItem);

        return (
        <article
          key={row.key}
          role={canOpenDetails ? 'button' : undefined}
          tabIndex={canOpenDetails ? 0 : undefined}
          onClick={canOpenDetails ? () => onDetails(row) : undefined}
          onKeyDown={
            canOpenDetails
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onDetails(row);
                  }
                }
              : undefined
          }
          className={`nutrition-food-card glass-panel w-full min-w-0 overflow-hidden rounded-3xl border border-subtle flex flex-col hover:border-accent/40 transition-colors group ${
            canOpenDetails ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50' : ''
          }`}
          onMouseEnter={() => onPrefetch?.(row)}
          onFocus={() => onPrefetch?.(row)}
        >
          {row.imageUrl ? (
            <div className="relative w-full aspect-[16/9] min-h-[120px] max-h-[180px] sm:min-h-[140px] sm:max-h-[200px] xl:max-h-[220px] bg-elevated">
              <img
                src={row.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                loading="lazy"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none"
                aria-hidden
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-3 p-4 sm:gap-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-start">
                <span className="inline-block text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 bg-accent/5 px-2.5 py-1 rounded-full border border-accent/10 mb-2">
                  {row.category}
                </span>
                <h3 className="text-base font-black text-foreground break-words leading-snug group-hover:text-accent transition-colors sm:text-lg">
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
                  onClick={(e) => {
                    e.stopPropagation();
                    onLog(row);
                  }}
                  className="size-10 shrink-0 rounded-xl bg-accent text-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg shadow-accent/20 sm:size-11"
                  aria-label={t('nutrition.logMeal')}
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>

            <div className="nutrition-food-macro-grid">
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
                  className="min-w-0 rounded-2xl bg-elevated/80 border border-subtle px-2 py-2.5 text-center sm:px-3 sm:py-3"
                >
                  <p className="nutrition-food-macro-value font-black tabular-nums" style={macro.colorStyle}>
                    {macro.value}
                    {macro.suffix}
                  </p>
                  <p className="text-[11px] sm:text-xs font-bold text-muted mt-2 tracking-wide">{macro.label}</p>
                </div>
              ))}
            </div>
          </div>
        </article>
        );
      })}
    </div>
  );
};
