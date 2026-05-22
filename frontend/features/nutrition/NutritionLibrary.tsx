import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { NutritionHero } from './NutritionHero';
import { NutritionCategoryGrid } from './NutritionCategoryGrid';
import { NutritionFoodList, type NutritionFoodRow } from './NutritionFoodList';
import { NutritionDetailsModal } from './NutritionDetailsModal';
import { NutritionLogModal } from './NutritionLogModal';
import nutritionService, { type DailyNutritionSummary } from '../../services/nutritionService';
import type { TranslationKey } from '../../lib/i18n/translations';
import type { FdcCategory, FdcFoodPreview, FdcSearchResult } from '../../types';
import {
  countActiveFilters,
  DEFAULT_NUTRITION_FILTERS,
  filtersToApiParams,
  type NutritionFilterState,
} from './nutritionFilters';
import {
  buildNutritionSearchKey,
  minNutritionSearchLength,
  NUTRITION_SEARCH_DEBOUNCE_MS,
  shouldRunNutritionSearch,
} from './nutritionSearch';
import { mapNutritionApiError } from './nutritionApiErrors';
import { catTranslationKey, resolveCategoryLabel, resolveFoodDisplayName } from './nutritionLocale';
import type { AppLanguage } from '../../services/settingsService';
import { QuestionnaireGate } from '../onboarding/QuestionnaireGate';

const PAGE_SIZE = 25;

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=400';

type DisplayRow = NutritionFoodRow;

function previewKey(f: FdcFoodPreview): string {
  return `w-${f.webtebId ?? 0}`;
}

function mergeFoodPages(prev: FdcFoodPreview[], foods: FdcFoodPreview[]): FdcFoodPreview[] {
  const seen = new Set(prev.map(previewKey));
  const added = foods.filter((f) => !seen.has(previewKey(f)));
  return [...prev, ...added];
}

function previewToRow(
  p: FdcFoodPreview,
  t: (key: TranslationKey, params?: Record<string, string>) => string,
  language: AppLanguage
): DisplayRow {
  const category = resolveCategoryLabel(p.categoryId, p.foodCategory, t, language);
  return {
    key: `webteb-${p.webtebId}`,
    name: resolveFoodDisplayName(p.name, p.nameEn, language),
    category,
    calories: p.calories,
    protein: p.protein,
    carbs: p.carbs,
    fat: p.fat,
    fdcPreview: { ...p, source: 'webteb' },
  };
}

export const NutritionLibrary: React.FC = () => {
  const { t, isRtl, language } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<FdcCategory[]>([]);
  const [catalogTotalFoods, setCatalogTotalFoods] = useState(0);
  const [viewMode, setViewMode] = useState<'categories' | 'foods'>('categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [fdcResultsRaw, setFdcResultsRaw] = useState<FdcFoodPreview[]>([]);
  const [filters, setFilters] = useState<NutritionFilterState>(DEFAULT_NUTRITION_FILTERS);
  const [foodPage, setFoodPage] = useState(1);
  const [apiHasMore, setApiHasMore] = useState(false);
  const [totalHits, setTotalHits] = useState(0);
  const [foodSearching, setFoodSearching] = useState(false);
  const [servedSearchKey, setServedSearchKey] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setSummary] = useState<DailyNutritionSummary | null>(null);
  const [logTarget, setLogTarget] = useState<DisplayRow | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<DisplayRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const apiFilterParams = useMemo(() => filtersToApiParams(filters), [filters]);
  const filterSig = useMemo(() => JSON.stringify(apiFilterParams), [apiFilterParams]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);
  const searchAbortRef = useRef<AbortController | null>(null);
  const fetchGenRef = useRef(0);
  const tRef = useRef(t);
  tRef.current = t;

  const applySearchPayload = useCallback((data: FdcSearchResult, append: boolean) => {
      const foods = data.foods ?? [];
      setFoodPage(data.currentPage ?? 1);
      setTotalHits(data.totalHits ?? 0);
      setFdcResultsRaw((prev) => {
        const next = append ? mergeFoodPages(prev, foods) : foods;
        const addedCount = append ? next.length - prev.length : next.length;
        const serverHasMore = data.hasMore === true;
        setApiHasMore(serverHasMore && (addedCount > 0 || !append));
        return next;
      });
    },
    []
  );

  const fetchFoods = useCallback(
    async (opts: { page: number; append: boolean; categoryId?: string | null; q?: string }) => {
      const gen = ++fetchGenRef.current;
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      const searchParams = {
        q: opts.q,
        categoryId: opts.categoryId || undefined,
        page: opts.page,
        pageSize: PAGE_SIZE,
        ...apiFilterParams,
      };

      if (!opts.append) {
        setError(null);
        const cached = nutritionService.peekSearchFoods(searchParams);
        if (cached?.data) {
          applySearchPayload(cached.data, false);
          const key = buildNutritionSearchKey(opts.q ?? '', opts.categoryId ?? null);
          setServedSearchKey(key);
          setFoodSearching(false);
        } else {
          setFoodSearching(true);
          setFdcResultsRaw([]);
          setTotalHits(0);
        }
      }

      try {
        const res = await nutritionService.searchFoods(searchParams, controller.signal);

        if (gen !== fetchGenRef.current || controller.signal.aborted || res.error === 'aborted') {
          return;
        }

        if (res.error) {
          const msg = mapNutritionApiError(res.error, tRef.current);
          if (msg) setError(msg);
          if (!opts.append && !nutritionService.peekSearchFoods(searchParams)?.data) {
            setFdcResultsRaw([]);
          }
          return;
        }
        setError(null);
        if (res.data) applySearchPayload(res.data, opts.append);
        if (!opts.append) {
          const key = buildNutritionSearchKey(opts.q ?? '', opts.categoryId ?? null);
          setServedSearchKey(key);
        }
      } finally {
        if (gen === fetchGenRef.current && !opts.append) {
          setFoodSearching(false);
        }
      }
    },
    [apiFilterParams, applySearchPayload]
  );

  const fetchFoodsRef = useRef(fetchFoods);
  fetchFoodsRef.current = fetchFoods;

  const reloadSummary = useCallback(() => {
    return nutritionService.getDailySummary().then((sum) => {
      if (sum.data) setSummary(sum.data);
    });
  }, []);

  const loadCategories = useCallback(() => {
    setLoading(true);
    return Promise.all([
      nutritionService.getCategories(),
      nutritionService.getDailySummary(),
    ])
      .then(([cats, sum]) => {
        if (cats.data?.categories) setCategories(cats.data.categories);
        const total =
          cats.data?.totalFoods ??
          cats.data?.categories?.reduce((sum, c) => sum + (c.foodCount ?? 0), 0) ??
          0;
        setCatalogTotalFoods(total);
        if (sum.data) setSummary(sum.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const prefetchCategory = useCallback(
    (categoryId: string) => {
      nutritionService.prefetchSearchFoods({
        categoryId,
        page: 1,
        pageSize: PAGE_SIZE,
        ...apiFilterParams,
      });
    },
    [apiFilterParams]
  );

  const openCategory = (id: string) => {
    setSelectedCategoryId(id);
    setViewMode('foods');
    setSearchQuery('');
    setServedSearchKey('');
    setError(null);
    fetchFoodsRef.current({ page: 1, append: false, categoryId: id });
  };

  const backToCategories = () => {
    setViewMode('categories');
    setSelectedCategoryId(null);
    setFdcResultsRaw([]);
    setTotalHits(0);
    setSearchQuery('');
    setServedSearchKey('');
    setFiltersOpen(false);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const q = value.trim();
    if (shouldRunNutritionSearch(q)) {
      const cached = nutritionService.peekSearchFoods({
        q,
        categoryId: selectedCategoryId || undefined,
        page: 1,
        pageSize: PAGE_SIZE,
        ...apiFilterParams,
      });
      if (!cached?.data) {
        setFoodSearching(true);
        setFdcResultsRaw([]);
        setTotalHits(0);
      }
    } else if (q.length === 0) {
      setServedSearchKey('');
      setFdcResultsRaw([]);
      setTotalHits(0);
      if (selectedCategoryId) {
        setFoodSearching(true);
      } else {
        setFoodSearching(false);
        setViewMode('categories');
      }
    }
  };

  const fetchContextRef = useRef({ q: '', categoryId: null as string | null });
  fetchContextRef.current = { q: searchQuery.trim(), categoryId: selectedCategoryId };

  // Live search: global on main page, category-scoped inside a section.
  useEffect(() => {
    const q = searchQuery.trim();

    if (!shouldRunNutritionSearch(q)) {
      if (selectedCategoryId) {
        setViewMode('foods');
        if (q.length === 0) {
          fetchFoodsRef.current({ page: 1, append: false, categoryId: selectedCategoryId });
        }
      } else {
        setFdcResultsRaw([]);
        setTotalHits(0);
        setFoodSearching(false);
        setViewMode('categories');
      }
      return;
    }

    setViewMode('foods');
    const timer = setTimeout(() => {
      fetchFoodsRef.current({
        page: 1,
        append: false,
        q,
        categoryId: selectedCategoryId || undefined,
      });
    }, NUTRITION_SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategoryId]);

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
      if (q.length >= minNutritionSearchLength(q)) {
        fetchFoodsRef.current({ page: 1, append: false, q, categoryId: categoryId || undefined });
        return;
      }
      if (categoryId) {
        fetchFoodsRef.current({ page: 1, append: false, categoryId });
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [filterSig, language, viewMode]);

  const displayRows = useMemo(
    () => fdcResultsRaw.map((p) => previewToRow(p, t, language)),
    [fdcResultsRaw, t, language]
  );
  const showLoadMore = apiHasMore && displayRows.length > 0;
  const loadMore = () => {
    if (loadingMore || !showLoadMore) return;
    setLoadingMore(true);
    const q = searchQuery.trim();
    fetchFoods({
      page: foodPage + 1,
      append: true,
      categoryId: selectedCategoryId,
      q: q.length >= minNutritionSearchLength(q) ? q : undefined,
    }).finally(() => setLoadingMore(false));
  };

  const prefetchFoodRow = useCallback((row: DisplayRow) => {
    const id = row.fdcPreview?.webtebId;
    if (id) nutritionService.prefetchFoodDetails(Number(id));
  }, []);

  const openLog = (row: DisplayRow) => {
    prefetchFoodRow(row);
    setLogTarget(row);
  };

  const openDetails = (row: DisplayRow) => {
    prefetchFoodRow(row);
    setDetailsTarget(row);
  };

  const hasActiveSearch = shouldRunNutritionSearch(searchQuery);
  /** Main page: hide sections while global search is active; show again when search is cleared. */
  const showCategoryGrid = !selectedCategoryId && !hasActiveSearch;
  const showFoodPanel = Boolean(selectedCategoryId) || hasActiveSearch;
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId]
  );
  const categoryLabel = selectedCategoryId
    ? resolveCategoryLabel(
        selectedCategoryId,
        selectedCategory?.nameAr ?? null,
        t,
        language,
        selectedCategory?.query
      )
    : null;
  const inCategory = Boolean(selectedCategoryId);
  const activeSearchKey = buildNutritionSearchKey(searchQuery, selectedCategoryId);
  const searchResultsReady = !hasActiveSearch || servedSearchKey === activeSearchKey;
  const heroSearching = hasActiveSearch && (foodSearching || !searchResultsReady);
  const showSearchEmpty =
    hasActiveSearch && searchResultsReady && !foodSearching && displayRows.length === 0;
  const showFoodList = displayRows.length > 0 && (!hasActiveSearch || !showSearchEmpty);
  const showSearchLoading = hasActiveSearch && !showFoodList && !showSearchEmpty;
  const showBrowseLoading = !hasActiveSearch && foodSearching && displayRows.length === 0;

  const clearSearch = () => {
    setSearchQuery('');
    setFdcResultsRaw([]);
    setTotalHits(0);
    setServedSearchKey('');
    setFoodSearching(false);
    setViewMode('categories');
    setFiltersOpen(false);
  };

  const searchAllCategories = () => {
    const q = searchQuery.trim();
    if (!shouldRunNutritionSearch(q)) return;
    setSelectedCategoryId(null);
    setViewMode('foods');
    fetchFoodsRef.current({ page: 1, append: false, q });
  };

  const handleBack = () => {
    if (selectedCategoryId) backToCategories();
    else clearSearch();
  };

  const runSearchSubmit = () => {
    const q = searchQuery.trim();
    if (!shouldRunNutritionSearch(q)) return;
    setViewMode('foods');
    fetchFoodsRef.current({
      page: 1,
      append: false,
      q,
      categoryId: selectedCategoryId || undefined,
    });
  };

  return (
    <QuestionnaireGate flow="diet" questionnairePath="/onboarding/diet">
    <section className="main-section page-shell max-w-6xl mx-auto px-0 sm:px-0 pb-2 space-y-8 sm:space-y-10">
      <NutritionHero
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onSearchSubmit={runSearchSubmit}
        searching={heroSearching}
        updating={hasActiveSearch && foodSearching && displayRows.length > 0}
        categoryLabel={categoryLabel}
        inCategory={inCategory}
        filters={filters}
        onFiltersChange={setFilters}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        activeFilterCount={activeFilterCount}
        showFilters={inCategory}
        catalogTotalFoods={catalogTotalFoods}
        catalogLoading={loading}
      />

      {toast && (
        <div className="p-3 rounded-xl bg-accent/10 border border-accent/30 text-accent text-sm text-center">
          {toast}
        </div>
      )}

      {showCategoryGrid && (
        <NutritionCategoryGrid
          categories={categories}
          loading={loading}
          onSelect={openCategory}
          onPrefetch={prefetchCategory}
        />
      )}

      {showFoodPanel && (
        <div className="space-y-6">
          {(selectedCategoryId || hasActiveSearch) && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="text-accent font-black text-xs uppercase tracking-widest flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">{isRtl ? 'arrow_forward' : 'arrow_back'}</span>
              {selectedCategoryId ? t('nutrition.backToCategories') : t('nutrition.clearSearch')}
            </button>
            {totalHits > 0 && (
              <div
                className="inline-flex items-center gap-2.5 rounded-2xl border border-accent/35 bg-accent/10 px-4 py-2.5 shadow-[0_0_20px_rgba(234,88,12,0.08)]"
                aria-live="polite"
              >
                <span className="text-2xl sm:text-3xl font-black tabular-nums leading-none text-accent">
                  {totalHits.toLocaleString()}
                </span>
                <span className="text-sm sm:text-base font-black text-foreground">
                  {t('nutrition.resultsCountUnit')}
                </span>
              </div>
            )}
            {error && <p className="text-xs text-red-400 w-full">{error}</p>}
          </div>
          )}

          {hasActiveSearch && !selectedCategoryId && (
            <h2 className="text-lg font-black text-foreground">
              {t('nutrition.searchResultsTitle', { query: searchQuery.trim() })}
            </h2>
          )}

          <div className="min-w-0 space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
              {selectedCategoryId && !searchQuery.trim() && (
                <h2 className="text-xl font-black text-foreground">{t(catTranslationKey(selectedCategoryId))}</h2>
              )}

              {(showBrowseLoading || showSearchLoading) && (
                <div className="glass-panel p-12 rounded-3xl text-center space-y-4">
                  <span className="inline-block size-10 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  <p className="text-accent font-bold animate-pulse">
                    {showSearchLoading ? t('nutrition.searching') : t('nutrition.loading')}
                  </p>
                </div>
              )}

              {showSearchEmpty && (
                <div className="glass-panel p-10 rounded-3xl text-center space-y-4 text-muted">
                  <span className="material-symbols-outlined text-4xl text-faint">search_off</span>
                  <p className="text-sm sm:text-base leading-relaxed font-bold text-foreground">
                    {inCategory
                      ? t('nutrition.noFoodsInCategory', {
                          query: searchQuery.trim(),
                          category: t(catTranslationKey(selectedCategoryId!)),
                        })
                      : t('nutrition.noFoodsSearch', { query: searchQuery.trim() })}
                  </p>
                  <p className="text-xs text-faint">{t('nutrition.searchEmptyHint')}</p>
                  {inCategory && (
                    <button
                      type="button"
                      onClick={searchAllCategories}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-accent/10 border border-accent/30 text-accent font-black text-xs uppercase tracking-widest hover:bg-accent/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">travel_explore</span>
                      {t('nutrition.searchAllCategories')}
                    </button>
                  )}
                </div>
              )}

              {!hasActiveSearch &&
                !foodSearching &&
                displayRows.length === 0 &&
                !showSearchLoading &&
                !error && (
                <div className="glass-panel p-10 rounded-3xl text-center space-y-4 text-muted">
                  <p className="text-sm sm:text-base leading-relaxed">
                    {activeFilterCount > 0
                      ? t('nutrition.noFoodsFiltered')
                      : selectedCategoryId
                        ? t('nutrition.categoryBrowseEmpty')
                        : t('nutrition.noFoods', { query: '' })}
                  </p>
                </div>
              )}

              {showFoodList && (
                <NutritionFoodList
                  rows={displayRows}
                  onLog={openLog}
                  onDetails={openDetails}
                  onPrefetch={prefetchFoodRow}
                />
              )}

              {showLoadMore && (
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
      )}

      <NutritionDetailsModal row={detailsTarget} onClose={() => setDetailsTarget(null)} />

      <NutritionLogModal
        row={logTarget}
        onClose={() => setLogTarget(null)}
        onLogged={(message) => {
          setToast(message);
          setLogTarget(null);
          reloadSummary();
          setTimeout(() => setToast(null), 2500);
        }}
      />
    </section>
    </QuestionnaireGate>
  );
};
