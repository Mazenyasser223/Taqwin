import React from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import type { TranslationKey } from '../../lib/i18n/translations';
import type { FoodSort } from '../../types';
import {
  DEFAULT_NUTRITION_FILTERS,
  type MacroPreset,
  type NutritionFilterState,
} from './nutritionFilters';

const PRESETS: MacroPreset[] = ['highProtein', 'lowCal', 'lowCarb', 'keto', 'lowFat'];

function presetKey(p: MacroPreset): TranslationKey {
  return `nutrition.preset.${p}` as TranslationKey;
}

type NumField = {
  key: keyof Pick<
    NutritionFilterState,
    | 'minCalories'
    | 'maxCalories'
    | 'minProtein'
    | 'maxProtein'
    | 'minCarbs'
    | 'maxCarbs'
    | 'minFat'
    | 'maxFat'
  >;
  label: TranslationKey;
};

const MACRO_FIELDS: NumField[] = [
  { key: 'minCalories', label: 'nutrition.minCalories' },
  { key: 'maxCalories', label: 'nutrition.maxCalories' },
  { key: 'minProtein', label: 'nutrition.minProtein' },
  { key: 'maxProtein', label: 'nutrition.maxProtein' },
  { key: 'minCarbs', label: 'nutrition.minCarbs' },
  { key: 'maxCarbs', label: 'nutrition.maxCarbs' },
  { key: 'minFat', label: 'nutrition.minFat' },
  { key: 'maxFat', label: 'nutrition.maxFat' },
];

const inputClass =
  'w-full bg-elevated border border-subtle rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent/40';

export const NutritionFilterPanel: React.FC<{
  filters: NutritionFilterState;
  onChange: (next: NutritionFilterState) => void;
  activeCount: number;
  loadedCount: number;
  matchCount: number;
  variant?: 'inline' | 'sidebar';
}> = ({ filters, onChange, activeCount, loadedCount, matchCount, variant = 'inline' }) => {
  const { t } = useI18n();
  const isSidebar = variant === 'sidebar';

  const patch = (partial: Partial<NutritionFilterState>) => onChange({ ...filters, ...partial });

  const setNum = (key: NumField['key'], raw: string) => {
    patch({ [key]: raw === '' ? '' : Math.max(0, Number(raw)), macroPreset: 'none' });
  };

  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-accent">{t('nutrition.filtersTitle')}</p>
          <p className="text-xs text-faint mt-1">{t('nutrition.filtersPer100g')}</p>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="text-[10px] font-black uppercase tracking-widest text-accent bg-accent/10 px-3 py-1 rounded-full">
              {t('nutrition.filtersActive', { count: String(activeCount) })}
            </span>
          )}
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_NUTRITION_FILTERS })}
            className="text-[10px] font-black uppercase tracking-widest text-faint hover:text-accent"
          >
            {t('nutrition.clearFilters')}
          </button>
        </div>
      </div>

      {loadedCount > 0 && (
        <p className="text-xs text-faint font-bold">
          {t('nutrition.filterMatchCount', {
            match: String(matchCount),
            loaded: String(loadedCount),
          })}
        </p>
      )}

      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-faint mb-2">{t('nutrition.presets')}</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => patch({ macroPreset: filters.macroPreset === p ? 'none' : p })}
              className={`px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                filters.macroPreset === p ? 'bg-accent text-white border-accent' : 'border-subtle text-faint hover:border-accent/50'
              }`}
            >
              {t(presetKey(p))}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid gap-3 ${isSidebar ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {MACRO_FIELDS.map(({ key, label }) => (
          <label key={key} className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-faint">{t(label)}</span>
            <input
              type="number"
              min={0}
              step={key.includes('Calories') ? 1 : 0.1}
              value={filters[key] === '' ? '' : filters[key]}
              onChange={(e) => setNum(key, e.target.value)}
              className={inputClass}
            />
          </label>
        ))}
      </div>

      <div className={`grid gap-4 ${isSidebar ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-faint">{t('nutrition.brandSearch')}</span>
          <input
            type="text"
            value={filters.brandQuery}
            onChange={(e) => patch({ brandQuery: e.target.value })}
            placeholder={t('nutrition.brandSearchPlaceholder')}
            className={inputClass}
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-faint">{t('nutrition.sortLabel')}</span>
          <select
            value={filters.sort}
            onChange={(e) => patch({ sort: e.target.value as FoodSort })}
            className={inputClass}
          >
            <option value="name">{t('nutrition.sortName')}</option>
            <option value="protein">{t('nutrition.sortProtein')}</option>
            <option value="proteinAsc">{t('nutrition.sortProteinAsc')}</option>
            <option value="calories">{t('nutrition.sortCalories')}</option>
            <option value="caloriesDesc">{t('nutrition.sortCaloriesDesc')}</option>
            <option value="carbs">{t('nutrition.sortCarbs')}</option>
            <option value="carbsDesc">{t('nutrition.sortCarbsDesc')}</option>
            <option value="fat">{t('nutrition.sortFat')}</option>
            <option value="fatDesc">{t('nutrition.sortFatDesc')}</option>
            <option value="proteinDensity">{t('nutrition.sortDensity')}</option>
          </select>
        </label>
      </div>

    </>
  );

  if (isSidebar) {
    return <div className="glass-panel rounded-2xl p-4 space-y-4 text-sm">{body}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="glass-panel rounded-3xl p-6 space-y-6 relative z-10 overflow-hidden"
    >
      {body}
    </motion.div>
  );
};
