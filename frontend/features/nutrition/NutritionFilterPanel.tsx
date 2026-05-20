import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { TranslationKey } from '../../lib/i18n/translations';
import {
  countActiveFilters,
  DEFAULT_NUTRITION_FILTERS,
  getMacroAmounts,
  getMacroDirection,
  type MacroKey,
  type MacroSortDirection,
  type NutritionFilterState,
} from './nutritionFilters';
import { NutritionMacroFilterRow } from './NutritionMacroFilterRow';

const MACROS: { key: MacroKey; label: TranslationKey }[] = [
  { key: 'calories', label: 'nutrition.filterRowCalories' },
  { key: 'carbs', label: 'nutrition.filterRowCarbs' },
  { key: 'protein', label: 'nutrition.filterRowProtein' },
  { key: 'fat', label: 'nutrition.filterRowFat' },
];

export const NutritionFilterPanel: React.FC<{
  filters: NutritionFilterState;
  onChange: (next: NutritionFilterState) => void;
  onClose?: () => void;
}> = ({ filters, onChange, onClose }) => {
  const { t } = useI18n();
  const activeCount = countActiveFilters(filters);

  const setMacroDirection = (macro: MacroKey, dir: MacroSortDirection) => {
    onChange({
      ...filters,
      toggles: { ...filters.toggles, [macro]: dir },
    });
  };

  const setMacroAmount = (macro: MacroKey, side: 'min' | 'max', raw: string) => {
    const value = raw === '' ? '' : Math.max(0, Number(raw));
    const nextAmounts = {
      ...filters.amounts[macro],
      [side]: value,
    };
    let nextToggle = filters.toggles[macro];

    if (value !== '') {
      nextToggle = side === 'min' ? 'high' : 'low';
    } else if (nextAmounts.min !== '') {
      nextToggle = 'high';
    } else if (nextAmounts.max !== '') {
      nextToggle = 'low';
    } else {
      nextToggle = 'off';
    }

    onChange({
      ...filters,
      toggles: { ...filters.toggles, [macro]: nextToggle },
      amounts: { ...filters.amounts, [macro]: nextAmounts },
    });
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-subtle shrink-0">
        <p className="text-xs font-black uppercase tracking-widest text-accent">{t('nutrition.sortLabel')}</p>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_NUTRITION_FILTERS })}
              className="text-[10px] font-black uppercase tracking-widest text-faint hover:text-accent"
            >
              {t('nutrition.clearFilters')}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="size-8 rounded-lg border border-subtle flex items-center justify-center text-faint hover:text-foreground"
              aria-label={t('common.cancel')}
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>
      </div>

      <div className="px-2.5 pt-2 pb-4 space-y-1 min-w-0">
        {MACROS.map(({ key, label }) => (
          <NutritionMacroFilterRow
            key={key}
            macroKey={key}
            label={label}
            direction={getMacroDirection(filters, key)}
            amounts={getMacroAmounts(filters, key)}
            onDirectionChange={(dir) => setMacroDirection(key, dir)}
            onAmountChange={(side, raw) => setMacroAmount(key, side, raw)}
          />
        ))}
      </div>
    </div>
  );
};
