import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { motion, AnimatePresence } from 'framer-motion';
import { buttonPress } from '../../lib/motion';
import { NutritionHero } from './NutritionHero';
import { NutritionCategoryGrid } from './NutritionCategoryGrid';
import { NutritionFoodList, type NutritionFoodRow } from './NutritionFoodList';
import nutritionService, { type DailyNutritionSummary } from '../../services/nutritionService';
import type { TranslationKey } from '../../lib/i18n/translations';
import type { FdcCategory, FdcFoodPreview, FdcDataType } from '../../types';
import { NutritionFilterPanel } from './NutritionFilterPanel';
import {
  countActiveFilters,
  DEFAULT_NUTRITION_FILTERS,
  filtersToApiParams,
  type NutritionFilterState,
} from './nutritionFilters';

const PAGE_SIZE = 50;
/** USDA whole / raw foods only (no branded commercial products). */
const WHOLE_FOOD_DATA_TYPES: FdcDataType[] = ['SR Legacy', 'Foundation'];

function catKey(id: string): TranslationKey {
  return `nutrition.cat.${id}` as TranslationKey;
}

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=400';

type DisplayRow = NutritionFoodRow;

function previewToRow(p: FdcFoodPreview): DisplayRow {
  const sub = [p.foodCategory, p.brandOwner].filter(Boolean).join(' · ');
  return {
    key: `fdc-${p.fdcId}`,
    name: p.name,
    category: p.foodCategory || p.dataType || 'USDA',
    calories: p.calories,
    protein: p.protein,
    carbs: p.carbs,
    fat: p.fat,
    subtitle: sub || undefined,
    fdcPreview: p,
  };
}

export const NutritionLibrary: React.FC = () => {
  const { t, isRtl, language } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<FdcCategory[]>([]);
  const [viewMode, setViewMode] = useState<'categories' | 'foods'>('categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [fdcResultsRaw, setFdcResultsRaw] = useState<FdcFoodPreview[]>([]);
  const [filters, setFilters] = useState<NutritionFilterState>(DEFAULT_NUTRITION_FILTERS);
  const [fdcPage, setFdcPage] = useState(1);
  const [nextUsdaPage, setNextUsdaPage] = useState(2);
  const [apiHasMore, setApiHasMore] = useState(false);
  const [totalHits, setTotalHits] = useState(0);
  const [fdcSearching, setFdcSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [logTarget, setLogTarget] = useState<DisplayRow | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const apiFilterParams = useMemo(() => filtersToApiParams(filters), [filters]);
  const filterSig = useMemo(() => JSON.stringify(apiFilterParams), [apiFilterParams]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const fetchFdc = useCallback(
    async (opts: {
      page: number;
      append: boolean;
      categoryId?: string | null;
      q?: string;
      usdaStartPage?: number;
    }) => {
      const res = await nutritionService.searchFdc({
        q: opts.q,
        categoryId: opts.categoryId || undefined,
        page: opts.page,
        pageSize: PAGE_SIZE,
        dataType: WHOLE_FOOD_DATA_TYPES,
        lang: language === 'ar' ? 'ar' : 'en',
        usdaStartPage: opts.usdaStartPage ?? 1,
        ...apiFilterParams,
      });
      if (res.error) {
        setError(res.error);
        if (!opts.append) setFdcResultsRaw([]);
        return;
      }
      setError(null);
      const foods = res.data?.foods ?? [];
      setTotalHits(res.data?.totalHits ?? 0);
      setFdcPage(res.data?.currentPage ?? opts.page);
      setNextUsdaPage(res.data?.nextUsdaPage ?? opts.page + 1);
      setApiHasMore(res.data?.hasMore ?? foods.length >= PAGE_SIZE);
      setFdcResultsRaw((prev) => (opts.append ? [...prev, ...foods] : foods));
    },
    [language, apiFilterParams]
  );

  const reloadSummary = useCallback(() => {
    return nutritionService.getDailySummary().then((sum) => {
      if (sum.data) setSummary(sum.data);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([nutritionService.getFdcCategories(), nutritionService.getDailySummary()])
      .then(([cats, sum]) => {
        if (cats.data?.categories) setCategories(cats.data.categories);
        if (sum.data) setSummary(sum.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const openCategory = (id: string) => {
    setSelectedCategoryId(id);
    setViewMode('foods');
    setSearchQuery('');
    setFdcSearching(true);
    fetchFdc({ page: 1, append: false, categoryId: id, usdaStartPage: 1 }).finally(() =>
      setFdcSearching(false)
    );
  };

  const backToCategories = () => {
    setViewMode('categories');
    setSelectedCategoryId(null);
    setFdcResultsRaw([]);
    setTotalHits(0);
    setSearchQuery('');
  };

  const fetchContextRef = useRef({ q: '', categoryId: null as string | null });
  fetchContextRef.current = { q: searchQuery.trim(), categoryId: selectedCategoryId };

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      if (!selectedCategoryId) {
        setFdcResultsRaw([]);
        setTotalHits(0);
        if (!q) setViewMode('categories');
      }
      return;
    }

    setViewMode('foods');
    setSelectedCategoryId(null);
    const timer = setTimeout(() => {
      setFdcSearching(true);
      fetchFdc({ page: 1, append: false, q, usdaStartPage: 1 }).finally(() => setFdcSearching(false));
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchFdc, selectedCategoryId]);

  const prevFilterSig = useRef(filterSig);
  const prevLang = useRef(language);

  // Refetch from API when filters or language change (not on category/search navigation).
  useEffect(() => {
    if (prevFilterSig.current === filterSig && prevLang.current === language) return;
    prevFilterSig.current = filterSig;
    prevLang.current = language;

    if (viewMode !== 'foods') return;

    const timer = setTimeout(() => {
      const { q, categoryId } = fetchContextRef.current;
      if (q.length >= 2) {
        setFdcSearching(true);
        fetchFdc({ page: 1, append: false, q, usdaStartPage: 1 }).finally(() => setFdcSearching(false));
        return;
      }
      if (categoryId) {
        setFdcSearching(true);
        fetchFdc({ page: 1, append: false, categoryId, usdaStartPage: 1 }).finally(() =>
          setFdcSearching(false)
        );
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [filterSig, language, viewMode, fetchFdc]);

  const displayRows = useMemo(() => fdcResultsRaw.map(previewToRow), [fdcResultsRaw]);
  const hasMore = apiHasMore || fdcResultsRaw.length < totalHits;

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const q = searchQuery.trim();
    fetchFdc({
      page: fdcPage + 1,
      append: true,
      categoryId: selectedCategoryId,
      q: q.length >= 2 ? q : undefined,
      usdaStartPage: nextUsdaPage,
    }).finally(() => setLoadingMore(false));
  };

  const openLog = (row: DisplayRow) => {
    setLogTarget(row);
    setGrams(100);
  };

  const submitLog = async () => {
    if (!logTarget) return;
    setLogSubmitting(true);
    let foodId = logTarget.foodItem?.id;

    if (!foodId && logTarget.fdcPreview) {
      const resolved = await nutritionService.resolveFoodForLog(logTarget.fdcPreview);
      if (resolved.error || !resolved.data) {
        setLogSubmitting(false);
        setToast(resolved.error || 'Could not import food');
        setTimeout(() => setToast(null), 2500);
        return;
      }
      foodId = resolved.data.id;
    }

    if (!foodId) {
      setLogSubmitting(false);
      return;
    }

    const res = await nutritionService.logFood({ foodItemId: foodId, grams });
    setLogSubmitting(false);
    if (res.error) {
      setToast(res.error);
    } else {
      setToast(`${t('nutrition.logMeal')}: ${grams}g ${logTarget.name}`);
      setLogTarget(null);
      reloadSummary();
    }
    setTimeout(() => setToast(null), 2500);
  };

  const showBrowse = viewMode === 'categories' && searchQuery.trim().length < 2;
  const categoryLabel = selectedCategoryId ? t(catKey(selectedCategoryId)) : null;

  const runSearchSubmit = () => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setViewMode('foods');
    setSelectedCategoryId(null);
    setFdcSearching(true);
    fetchFdc({ page: 1, append: false, q, usdaStartPage: 1 }).finally(() => setFdcSearching(false));
  };

  const logMacrosScaled = useMemo(() => {
    if (!logTarget) return null;
    const factor = grams / 100;
    return {
      calories: Math.round(logTarget.calories * factor),
      carbs: Math.round(logTarget.carbs * factor * 10) / 10,
      fat: Math.round(logTarget.fat * factor * 10) / 10,
      protein: Math.round(logTarget.protein * factor * 10) / 10,
    };
  }, [logTarget, grams]);

  return (
    <section className="main-section max-w-6xl mx-auto px-4 sm:px-6 pb-24 space-y-10">
      <NutritionHero
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={runSearchSubmit}
        categoryLabel={showBrowse ? null : categoryLabel}
      />

      {toast && (
        <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 text-accent text-sm text-center">
          {toast}
        </div>
      )}

      {showBrowse ? (
        <NutritionCategoryGrid categories={categories} loading={loading} onSelect={openCategory} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={backToCategories}
              className="text-accent font-black text-xs uppercase tracking-widest flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">{isRtl ? 'arrow_forward' : 'arrow_back'}</span>
              {t('nutrition.backToCategories')}
            </button>
            {totalHits > 0 && (
              <p className="text-xs text-faint font-bold">
                {t('nutrition.resultsCount', { count: String(totalHits.toLocaleString()) })}
              </p>
            )}
            {error && <p className="text-xs text-red-400 w-full">{error}</p>}
          </div>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className="lg:hidden w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-subtle bg-elevated font-black text-xs uppercase tracking-widest"
          >
            {t('nutrition.filters')}
            {activeFilterCount > 0 && (
              <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-accent text-white text-[10px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div
            className="grid lg:grid-cols-[minmax(240px,280px)_1fr] gap-6 lg:gap-8 items-start"
            dir="ltr"
          >
            <aside
              className={`lg:sticky lg:top-20 lg:self-start z-10 ${mobileFiltersOpen ? 'block' : 'hidden lg:block'}`}
            >
              <NutritionFilterPanel
                variant="sidebar"
                filters={filters}
                onChange={setFilters}
                activeCount={activeFilterCount}
                loadedCount={fdcResultsRaw.length}
                matchCount={fdcResultsRaw.length}
              />
            </aside>

            <div className="min-w-0 space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
              {selectedCategoryId && !searchQuery.trim() && (
                <h2 className="text-xl font-black text-foreground">{t(catKey(selectedCategoryId))}</h2>
              )}

              {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
                <p className="text-sm text-faint">{t('nutrition.searchHint')}</p>
              )}

              {fdcSearching && fdcResultsRaw.length === 0 && (
                <p className="text-accent animate-pulse">{t('nutrition.searching')}</p>
              )}

              {!fdcSearching && displayRows.length === 0 && (
                <div className="glass-panel p-10 rounded-3xl text-center text-muted">
                  {t('nutrition.noFoods', {
                    query: searchQuery || (selectedCategoryId ? t(catKey(selectedCategoryId)) : ''),
                  })}
                </div>
              )}

              {displayRows.length > 0 && <NutritionFoodList rows={displayRows} onLog={openLog} />}

              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-8 py-3 rounded-2xl bg-accent text-white font-black text-xs uppercase tracking-widest disabled:opacity-50"
                  >
                    {loadingMore ? t('nutrition.loading') : t('nutrition.loadMore')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {logTarget && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 p-6 backdrop-blur-md"
                onClick={() => setLogTarget(null)}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => e.stopPropagation()}
                  className="glass-panel w-full max-w-md rounded-3xl border border-subtle p-8 space-y-6 shadow-2xl"
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={logTarget.imageUrl || FALLBACK_IMG}
                      className="size-16 rounded-2xl object-cover"
                      alt={logTarget.name}
                    />
                    <div className="min-w-0">
                      <h3 className="text-xl font-black break-words">{logTarget.name}</h3>
                      <p className="text-xs uppercase text-accent font-black tracking-widest">{logTarget.category}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-faint font-black">Grams</label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={grams}
                      onChange={(e) => setGrams(Math.max(1, Number(e.target.value) || 0))}
                      className="w-full bg-elevated border border-subtle rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    {logMacrosScaled && (
                      <div className="rounded-xl bg-elevated/80 border border-subtle px-4 py-3 space-y-2 text-sm">
                        {(
                          [
                            { label: t('nutrition.logCal'), value: logMacrosScaled.calories, suffix: '' },
                            { label: t('nutrition.logCarb'), value: logMacrosScaled.carbs, suffix: 'g' },
                            { label: t('nutrition.logFat'), value: logMacrosScaled.fat, suffix: 'g' },
                            { label: t('nutrition.logProtein'), value: logMacrosScaled.protein, suffix: 'g' },
                          ] as const
                        ).map((row) => (
                          <div key={row.label} className="flex items-center justify-between gap-4">
                            <span className="text-faint font-bold">{row.label}:</span>
                            <span className="text-foreground font-black tabular-nums">
                              {row.value}
                              {row.suffix}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setLogTarget(null)}
                      className="flex-1 bg-elevated border border-subtle py-3 rounded-xl font-bold"
                    >
                      {t('common.cancel')}
                    </button>
                    <motion.button
                      variants={buttonPress}
                      whileHover="hover"
                      whileTap="tap"
                      onClick={submitLog}
                      disabled={logSubmitting}
                      className="flex-1 bg-accent text-white font-bold py-3 rounded-xl disabled:opacity-50"
                    >
                      {logSubmitting ? t('nutrition.logging') : t('nutrition.logFood')}
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </section>
  );
};
