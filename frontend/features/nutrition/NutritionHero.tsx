import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { TranslationKey } from '../../lib/i18n/translations';
import { NutritionFilterMenu } from './NutritionFilterMenu';
import type { NutritionFilterState } from './nutritionFilters';

type Props = {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
  categoryLabel?: string | null;
  /** When set, search is scoped to this category only. */
  inCategory?: boolean;
  searching?: boolean;
  /** True when refining results while some matches are already visible. */
  updating?: boolean;
  filters: NutritionFilterState;
  onFiltersChange: (next: NutritionFilterState) => void;
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  activeFilterCount: number;
  /** Show macro filter button (only inside a category, not on the categories home). */
  showFilters?: boolean;
  /** Total foods in catalog (shown beside search on categories home). */
  catalogTotalFoods?: number;
  catalogLoading?: boolean;
};

export const NutritionHero: React.FC<Props> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  categoryLabel,
  inCategory = false,
  searching = false,
  updating = false,
  filters,
  onFiltersChange,
  filtersOpen,
  onFiltersOpenChange,
  activeFilterCount,
  showFilters = false,
  catalogTotalFoods = 0,
  catalogLoading = false,
}) => {
  const { t, isRtl, language } = useI18n();
  const countLocale = language === 'ar' ? 'ar' : 'en';
  const showCatalogCount = !inCategory && !catalogLoading && catalogTotalFoods > 0;

  const titleKey: TranslationKey = inCategory && categoryLabel
    ? 'nutrition.heroTitleCategory'
    : 'nutrition.heroTitle';

  const placeholder = inCategory && categoryLabel
    ? t('nutrition.searchPlaceholderInCategory', { category: categoryLabel })
    : t('nutrition.searchPlaceholder');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit();
  };

  return (
    <header className="text-center space-y-6 max-w-3xl mx-auto">
      <div className="space-y-3">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground leading-snug">
          {inCategory && categoryLabel ? t(titleKey, { category: categoryLabel }) : t(titleKey)}
        </h1>
        <p className="text-sm sm:text-base text-muted font-medium leading-relaxed">
          {t('nutrition.heroSubtitle')}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row sm:items-stretch gap-2 max-w-3xl mx-auto w-full min-w-0 overflow-x-hidden"
      >
        <div className="flex gap-2 flex-1 min-w-0 items-stretch">
          {showCatalogCount && (
            <div
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-2xl border border-accent/35 bg-accent/10 px-2.5 sm:px-3 py-2 shrink-0 max-w-[42%] sm:max-w-none shadow-[0_0_16px_rgba(234,88,12,0.08)]"
              aria-live="polite"
            >
              <span className="text-lg sm:text-xl font-black tabular-nums leading-none text-accent">
                {catalogTotalFoods.toLocaleString(countLocale)}
              </span>
              <span className="text-[10px] sm:text-xs font-black text-foreground whitespace-nowrap">
                {t('nutrition.resultsCountUnit')}
              </span>
            </div>
          )}
          <div className="relative flex-1 min-w-0">
            <span className="material-symbols-outlined absolute start-4 top-1/2 -translate-y-1/2 text-faint pointer-events-none">
              search
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-elevated border border-subtle rounded-2xl ps-12 pe-4 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent/40 placeholder:text-faint"
              dir={isRtl ? 'rtl' : 'ltr'}
              autoComplete="off"
              enterKeyHint="search"
              aria-busy={searching || updating}
            />
            {(searching || updating) && (
              <span className="absolute end-3 top-1/2 -translate-y-1/2 size-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin pointer-events-none" />
            )}
          </div>
          {showFilters && (
            <NutritionFilterMenu
              open={filtersOpen}
              onOpenChange={onFiltersOpenChange}
              filters={filters}
              onChange={onFiltersChange}
              activeCount={activeFilterCount}
            />
          )}
        </div>
        <button
          type="submit"
          disabled={searching && !updating}
          className="shrink-0 px-6 sm:px-8 py-4 rounded-2xl bg-accent text-white font-black text-sm uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {updating
            ? t('nutrition.updating')
            : searching
              ? t('nutrition.searching')
              : t('nutrition.searchButton')}
        </button>
      </form>
    </header>
  );
};
