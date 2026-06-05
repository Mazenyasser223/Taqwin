import React from 'react';
import { cn } from '../../lib/cn';
import { useI18n } from '../../lib/i18n/useI18n';
import type { AthleteHomeDashboard } from '../../services/dashboardService';
import { entryKcal, type MacrosPer100 } from './mealEntryMacros';
import { mealEntryHasDetails } from './mealEntryDetails';
import { PlanItemInfoButton } from './PlanItemInfoButton';

type MealItem = NonNullable<
  NonNullable<AthleteHomeDashboard['analytics']>['todayMealPlan']
>['slots'][number]['items'][number];

export type MealEditEntry = {
  key: string;
  name: string;
  grams: number;
  logId?: string;
  webtebId?: number;
  planItem?: MealItem;
  macrosPer100?: MacrosPer100;
};

export interface MealSlotInlineEditorProps {
  entries: MealEditEntry[];
  busyKey?: string | null;
  onChangeGrams: (key: string, grams: number) => void;
  onRemove: (key: string) => void;
  onAddFromNutrition: () => void;
  onDetails?: (entry: MealEditEntry) => void;
  canShowDetails?: (entry: MealEditEntry) => boolean;
}

export const MealSlotInlineEditor: React.FC<MealSlotInlineEditorProps> = ({
  entries,
  busyKey,
  onChangeGrams,
  onRemove,
  onAddFromNutrition,
  onDetails,
  canShowDetails = mealEntryHasDetails,
}) => {
  const { t } = useI18n();

  return (
    <div className="mt-2 space-y-2">
      <ul className="space-y-1.5">
        {entries.map((entry) => {
          const busy = busyKey === entry.key;
          const kcal = entryKcal(entry);
          return (
            <li
              key={entry.key}
              className="flex items-center justify-between gap-2 rounded-lg border border-brand-500/20 bg-brand-500/5 px-2 py-1.5 text-xs dark:bg-brand-500/10"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="material-symbols-outlined shrink-0 text-[14px] text-brand-500">restaurant</span>
                <span className="truncate font-medium text-gray-800 dark:text-white/90">{entry.name}</span>
                {onDetails ? (
                  <PlanItemInfoButton
                    size="sm"
                    disabled={busy || !canShowDetails(entry)}
                    onClick={() => onDetails(entry)}
                    ariaLabel={t('nutrition.details')}
                  />
                ) : null}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span className="inline-flex items-center gap-0.5 rounded-full border border-gray-200 bg-white px-1.5 py-0.5 dark:border-gray-700 dark:bg-gray-900">
                  <input
                    type="number"
                    min={5}
                    max={5000}
                    step={5}
                    value={Math.round(entry.grams)}
                    disabled={busy}
                    onChange={(e) => onChangeGrams(entry.key, Number(e.target.value))}
                    className="w-12 bg-transparent text-center text-xs font-semibold tabular-nums text-gray-800 outline-none dark:text-white/85"
                    aria-label={t('dashboard.editGrams')}
                  />
                  <span className="text-[11px] font-semibold text-gray-500">g</span>
                  <span className="mx-0.5 text-[11px] text-gray-400">·</span>
                  <span className="pr-1 text-xs font-semibold tabular-nums text-gray-800 dark:text-white/85">
                    {kcal} kcal
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onRemove(entry.key)}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full border border-error-500/30 text-error-500 transition-colors hover:bg-error-500/10 disabled:opacity-50'
                  )}
                  aria-label={t('dashboard.removeFood')}
                >
                  {busy ? (
                    <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  )}
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onAddFromNutrition}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-500/35 bg-brand-500/5 py-2 text-[11px] font-semibold text-brand-600 hover:bg-brand-500/10 dark:text-brand-400"
      >
        <span className="material-symbols-outlined text-base">restaurant</span>
        {t('dashboard.logFoodManually')}
      </button>
    </div>
  );
};
