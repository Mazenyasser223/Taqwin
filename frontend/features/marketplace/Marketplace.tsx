import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import { useI18n } from '../../lib/i18n/useI18n';

import { motion } from 'framer-motion';

import { staggerContainer, itemVariants } from '../../lib/motion';

import marketplaceService from '../../services/marketplaceService';

import { useCartStore } from '../../store/useCartStore';

import type { Product, ShopCategory } from '../../types';

import { ShopProductCard } from './ShopProductCard';

import { ShopProductSection } from './ShopProductSection';

import { ShopSidebar } from './ShopSidebar';

import { ShopSubcategoryStrip } from './ShopSubcategoryStrip';

import { ShopProductSkeleton } from './ShopProductSkeleton';
import { ShopProductDetailModal } from './ShopProductDetailModal';

import { groupByBrand } from './shopUtils';
import { MarketplaceSearchBar } from './MarketplaceSearchBar';
import { productPagePath } from './productPagePath';
import { CartToast } from './CartToast';
import { useCartActions } from './useCartActions';
import type { OrderSource } from '../../lib/orderAttribution';
import { mapSearchSuggestions, type MarketplaceSearchSuggestion } from './marketplaceSearchSuggestions';
import { useDebounce } from '../../lib/hooks/useDebounce';
import { trackShopFunnel } from '../../lib/shopFunnel';
import { ShopPersonalRecommendations } from './ShopPersonalRecommendations';
import { ShopPageHeader } from './ShopPageHeader';
import { ShopQuickFilters } from './ShopQuickFilters';
import { ShopFeaturedCategories } from './ShopFeaturedCategories';
import { ShopActiveFilters } from './ShopActiveFilters';
import { pickHomeSectionCategories } from './shopHomeUtils';
import { SHOP_SHELL, SHOP_PANEL, SHOP_PRODUCT_GRID } from './shopLayout';

import {

  browseSubcategories,

  findBrowseRoot,

  findCategoryNode,

} from './shopBrowseUtils';



const FALLBACK_IMG =

  'https://images.unsplash.com/photo-1593094859027-e9623c44810a?q=80&w=400';



const HOME_SECTION_LIMIT = 8;

const BROWSE_PER_PAGE = 12;

const HOME_SECTION_CONCURRENCY = 5;



export const Marketplace: React.FC = () => {

  const { t, language } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const detailProductId = searchParams.get('product');

  const [categories, setCategories] = useState<ShopCategory[]>([]);

  const [homeOffers, setHomeOffers] = useState<Product[]>([]);

  const [homeSections, setHomeSections] = useState<{ cat: ShopCategory; products: Product[] }[]>([]);

  const [homeLoading, setHomeLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [homeSectionsLoading, setHomeSectionsLoading] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);

  const [totalProducts, setTotalProducts] = useState(0);

  const [totalPages, setTotalPages] = useState(1);

  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const cart = useCartStore();
  const { addToCart, toast, dismissToast } = useCartActions();

  const [brandFilter, setBrandFilter] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const [offersOnly, setOffersOnly] = useState(false);

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') ?? '');

  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    void trackShopFunnel('visit');
  }, []);

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q.length >= 2) void trackShopFunnel('search', { query: q });
  }, [debouncedSearch]);

  const [searchSuggestions, setSearchSuggestions] = useState<MarketplaceSearchSuggestion[]>([]);

  const [suggestionsLoading, setSuggestionsLoading] = useState(true);



  const isSearchMode = debouncedSearch.trim().length > 0;

  const isBrowseHome = !categoryFilter && !brandFilter && !offersOnly && !isSearchMode;

  const addFromCatalog = useCallback(
    (product: Product, override?: OrderSource) => {
      let source: OrderSource = override ?? 'direct';
      if (!override) {
        if (isSearchMode) source = 'search';
        else if (categoryFilter) source = 'category';
        else if (offersOnly) source = 'featured';
        else source = 'featured';
      }
      addToCart(product, 1, { source });
    },
    [addToCart, isSearchMode, categoryFilter, offersOnly]
  );



  const brandGroups = useMemo(() => groupByBrand(products), [products]);



  const loadHomeSections = useCallback(async (cats: ShopCategory[]) => {

    const roots = pickHomeSectionCategories(cats);

    setHomeSectionsLoading(true);

    try {

      const sectionResults: { cat: ShopCategory; products: Product[] }[] = [];

      for (let i = 0; i < roots.length; i += HOME_SECTION_CONCURRENCY) {

        const batch = roots.slice(i, i + HOME_SECTION_CONCURRENCY);

        const batchResults = await Promise.all(

          batch.map(async (cat) => {

            const res = await marketplaceService.getProducts({

              category: cat.slug,

              limit: HOME_SECTION_LIMIT,

              page: 1,

            });

            return { cat, products: res.data?.items ?? [] };

          })

        );

        sectionResults.push(...batchResults.filter((s) => s.products.length > 0));

        setHomeSections([...sectionResults]);

      }

    } finally {

      setHomeSectionsLoading(false);

    }

  }, []);



  const loadHome = useCallback(

    async (cats: ShopCategory[]) => {

      setHomeLoading(true);

      setHomeSections([]);

      setError(null);

      try {

        const offersRes = await marketplaceService.getProducts({

          onSale: true,

          limit: 12,

          page: 1,

        });

        if (offersRes.error) {

          setError(offersRes.error);

          return;

        }

        setHomeOffers(offersRes.data?.items ?? []);

      } finally {

        setHomeLoading(false);

      }

      void loadHomeSections(cats);

    },

    [loadHomeSections]

  );



  useEffect(() => {

    let cancelled = false;

    setSuggestionsLoading(true);

    marketplaceService.getSearchSuggestions().then((res) => {

      if (cancelled) return;

      setSuggestionsLoading(false);

      if (res.data) setSearchSuggestions(mapSearchSuggestions(res.data, language));

    });

    return () => {

      cancelled = true;

    };

  }, [language]);



  const productsRequestId = useRef(0);

  const loadProducts = useCallback(async () => {

    if (isBrowseHome) {

      setLoading(false);

      return;

    }

    const requestId = ++productsRequestId.current;

    setLoading(true);

    setError(null);

    try {

      const res = await marketplaceService.getProducts({

        search: isSearchMode ? debouncedSearch.trim() : undefined,

        brand: brandFilter ?? undefined,

        category: categoryFilter ?? undefined,

        onSale: offersOnly || undefined,

        page,

        limit: BROWSE_PER_PAGE,

      });

      if (requestId !== productsRequestId.current) return;

      if (res.error) setError(res.error);

      else {

        setProducts(res.data?.items ?? []);

        setTotalProducts(res.data?.total ?? 0);

        setTotalPages(res.data?.totalPages ?? 1);

      }

    } catch {

      if (requestId !== productsRequestId.current) return;

      setError(t('shop.loadFailed'));

    } finally {

      if (requestId === productsRequestId.current) setLoading(false);

    }

  }, [brandFilter, categoryFilter, offersOnly, page, isBrowseHome, isSearchMode, debouncedSearch, t]);



  useEffect(() => {

    setPage(1);

  }, [debouncedSearch]);



  useEffect(() => {

    const fromUrl = searchParams.get('search') ?? '';

    setSearchQuery((prev) => (prev !== fromUrl ? fromUrl : prev));

  }, [searchParams]);



  useEffect(() => {

    const q = debouncedSearch.trim();

    setSearchParams((prev) => {

      const current = prev.get('search') ?? '';

      if (current === q) return prev;

      const next = new URLSearchParams(prev);

      if (q) next.set('search', q);

      else next.delete('search');

      return next;

    }, { replace: true });

  }, [debouncedSearch, setSearchParams]);



  useEffect(() => {

    let cancelled = false;

    setCategoriesLoading(true);

    setError(null);

    marketplaceService.getCategories().then((res) => {

      if (cancelled) return;

      setCategoriesLoading(false);

      if (res.error) {

        setError(res.error);

        setHomeLoading(false);

        return;

      }

      if (res.data) {

        setCategories(res.data);

        void loadHome(res.data);

      }

    });

    return () => {

      cancelled = true;

    };

  }, [loadHome]);



  useEffect(() => {

    loadProducts();

  }, [loadProducts]);



  const openProductDetail = useCallback(
    (id: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('product', id);
        return next;
      });
    },
    [setSearchParams]
  );

  const closeProductDetail = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('product');
      return next;
    });
  }, [setSearchParams]);

  const categoryLabel = (cat: { nameEn: string; nameAr?: string | null }) =>

    language === 'ar' && cat.nameAr ? cat.nameAr : cat.nameEn;



  const browseContext = useMemo(

    () => (categoryFilter && !offersOnly && !brandFilter ? findBrowseRoot(categories, categoryFilter) : null),

    [categoryFilter, offersOnly, brandFilter, categories]

  );



  const subcategories = useMemo(

    () => (browseContext ? browseSubcategories(browseContext.root) : []),

    [browseContext]

  );



  const resolvedCategoryTitle = useMemo(() => {

    if (offersOnly) return t('shop.offersSection');

    if (brandFilter) return brandFilter;

    if (!categoryFilter) return t('shop.products');

    const node = findCategoryNode(categories, categoryFilter);

    return node ? categoryLabel(node) : categoryFilter;

  }, [offersOnly, brandFilter, categoryFilter, categories, t, language]);



  const resultsRangeLabel = useMemo(() => {

    if (totalProducts === 0) return null;

    const from = (page - 1) * BROWSE_PER_PAGE + 1;

    const to = Math.min(page * BROWSE_PER_PAGE, totalProducts);

    return t('shop.resultsRange', {

      from: String(from),

      to: String(to),

      total: String(totalProducts),

    });

  }, [page, totalProducts, t]);



  const resetFilters = () => {

    setPage(1);

    setCategoryFilter(null);

    setBrandFilter(null);

    setOffersOnly(false);

    setSearchQuery('');

  };



  const applySearch = useCallback(

    (query: string) => {

      setPage(1);

      setCategoryFilter(null);

      setBrandFilter(null);

      setOffersOnly(false);

      setSearchQuery(query);

    },

    [],

  );



  const handleSuggestionSelect = (suggestion: MarketplaceSearchSuggestion) => {

    applySearch(suggestion.query);

  };



  const selectCategory = (slug: string | null) => {

    setPage(1);

    setSearchQuery('');

    setCategoryFilter(slug);

    setOffersOnly(false);

    setBrandFilter(null);

  };



  const saleBadge = (percent: number) => t('shop.saleBadge', { percent: String(percent) });



  const showHomeSpinner = isBrowseHome && categoriesLoading;

  const showHomeOffersLoading = isBrowseHome && !categoriesLoading && homeLoading && homeOffers.length === 0;

  const allInCategoryLabel = browseContext

    ? t('shop.allInCategory', { name: categoryLabel(browseContext.root) })

    : '';



  const toggleOffers = () => {

    setPage(1);

    setSearchQuery('');

    setOffersOnly((v) => !v);

    setCategoryFilter(null);

    setBrandFilter(null);

  };



  return (

    <div className={`${SHOP_SHELL} space-y-4 sm:space-y-6`}>

      <ShopPageHeader cartCount={cart.count()} />



      <div className={`${SHOP_PANEL} space-y-3 sm:space-y-4`}>

        <MarketplaceSearchBar

        value={searchQuery}

        onChange={setSearchQuery}

        onSubmit={applySearch}

        onSuggestionSelect={handleSuggestionSelect}

        onClear={() => applySearch('')}

        suggestions={searchSuggestions}

        suggestionsLoading={suggestionsLoading}

        loading={isSearchMode && loading}

        />



        <ShopQuickFilters

          categories={categories}

          isBrowseHome={isBrowseHome}

          offersOnly={offersOnly}

          categoryFilter={categoryFilter}

          onSelectHome={resetFilters}

          onToggleOffers={toggleOffers}

          onSelectCategory={selectCategory}

          labelFor={categoryLabel}

        />



        <p className="flex items-center gap-2 text-xs font-semibold text-muted sm:text-sm">

          <span className="material-symbols-outlined text-base text-[#f37021]">local_shipping</span>

          {t('shop.freeShipping')}

        </p>

      </div>



      {!isBrowseHome || isSearchMode ? (

        <ShopActiveFilters

          categoryLabel={categoryFilter && !offersOnly ? resolvedCategoryTitle : null}

          brandFilter={brandFilter}

          offersOnly={offersOnly}

          searchQuery={isSearchMode ? debouncedSearch : ''}

          onClear={resetFilters}

          onClearCategory={() => selectCategory(null)}

          onClearBrand={() => setBrandFilter(null)}

          onClearOffers={() => setOffersOnly(false)}

          onClearSearch={() => applySearch('')}

        />

      ) : null}



      {showHomeSpinner && (

        <div className="text-primary animate-pulse py-8">{t('shop.loading')}</div>

      )}

      {showHomeOffersLoading && (

        <div className="text-primary animate-pulse py-4 text-sm">{t('shop.loading')}</div>

      )}

      {error && (

        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">

          {error}

        </div>

      )}



      {!categoriesLoading && !error && isBrowseHome && (

        <div className="space-y-10 min-w-0">

          <div className={`${SHOP_PANEL}`}>

            <ShopPersonalRecommendations />

          </div>

          {homeOffers.length > 0 && (

            <ShopProductSection

              title={t('shop.offersSection')}

              products={homeOffers}

              viewAllLabel={t('shop.viewAll')}

              onViewAll={toggleOffers}

              onAdd={(p) => addFromCatalog(p, 'featured')}
              onOpen={(p) => openProductDetail(p.id)}

              inStockLabel={t('marketplace.inStock')}

              outOfStockLabel={t('shop.outOfStock')}

              addLabel={t('shop.addToCart')}

              saleBadgeLabel={saleBadge}

            />

          )}



          {categories.length > 0 && (

            <ShopFeaturedCategories

              categories={categories}

              labelFor={categoryLabel}

              isAllSelected={isBrowseHome}

              categoryFilter={categoryFilter}

              onSelectAll={resetFilters}

              onSelectCategory={selectCategory}

            />

          )}



          {homeSections.length > 0 && (

            <div className="space-y-8 min-w-0">

              <h2 className="text-lg font-black text-foreground sm:text-xl">{t('shop.popularPicks')}</h2>

              {homeSections.map(({ cat, products: sectionProducts }) => (

            <ShopProductSection

              key={cat.slug}

              title={categoryLabel(cat)}

              products={sectionProducts}

              viewAllLabel={t('shop.viewAll')}

              onViewAll={() => selectCategory(cat.slug)}

              onAdd={(p) => addFromCatalog(p, 'category')}
              onOpen={(p) => openProductDetail(p.id)}

              inStockLabel={t('marketplace.inStock')}

              outOfStockLabel={t('shop.outOfStock')}

              addLabel={t('shop.addToCart')}

              saleBadgeLabel={saleBadge}

            />

              ))}

            </div>

          )}

          {homeSectionsLoading && (

            <div className="text-primary animate-pulse text-sm py-2">{t('shop.loading')}</div>

          )}

          {!homeLoading && homeOffers.length === 0 && homeSections.length === 0 && !homeSectionsLoading && (

            <div className="glass-panel rounded-2xl p-10 text-center text-muted">{t('shop.empty')}</div>

          )}

        </div>

      )}



      {!error && isSearchMode && (

        <div className={`${SHOP_PANEL} min-w-0 space-y-4`}>

          <div className="flex flex-wrap items-end justify-between gap-2">

            <h2 className="text-lg font-black sm:text-xl">

              {t('shop.searchResultsFor', { query: debouncedSearch.trim() })}

            </h2>

            {resultsRangeLabel && !loading && (

              <p className="text-xs font-semibold text-muted">{resultsRangeLabel}</p>

            )}

          </div>



          {loading ? (

            <div className="space-y-4 min-w-0">

              <p className="text-primary animate-pulse text-sm">{t('shop.loading')}</p>

              <ShopProductSkeleton count={BROWSE_PER_PAGE} />

            </div>

          ) : products.length === 0 ? (

            <div className="rounded-2xl border border-subtle bg-elevated/50 p-10 text-center space-y-2">

              <p className="font-bold text-foreground">

                {t('shop.searchNoResults', { query: debouncedSearch.trim() })}

              </p>

              <p className="text-sm text-muted">{t('shop.searchNoResultsHint')}</p>

            </div>

          ) : (

            <>

              <motion.div

                variants={staggerContainer(0.04)}

                initial="hidden"

                animate="visible"

                className={SHOP_PRODUCT_GRID}

              >

                {products.map((product) => (

                  <motion.div key={product.id} variants={itemVariants}>

                    <ShopProductCard
                      product={product}
                      productTo={productPagePath(product) ?? undefined}
                      onOpen={
                        productPagePath(product)
                          ? undefined
                          : () => openProductDetail(product.id)
                      }
                      onAdd={() => addFromCatalog(product)}

                      inStockLabel={t('marketplace.inStock')}

                      outOfStockLabel={t('shop.outOfStock')}

                      addLabel={t('shop.addToCart')}

                      saleBadgeLabel={

                        product.discountPercent

                          ? saleBadge(product.discountPercent)

                          : undefined

                      }

                    />

                  </motion.div>

                ))}

              </motion.div>



              {totalPages > 1 && (

                <div className="flex items-center justify-center gap-3 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-2">

                  <button

                    type="button"

                    disabled={page <= 1 || loading}

                    onClick={() => setPage((p) => Math.max(1, p - 1))}

                    className="min-h-10 rounded-xl border border-subtle bg-elevated px-4 text-sm font-bold disabled:opacity-40"

                  >

                    {t('shop.prevPage')}

                  </button>

                  <span className="text-sm font-semibold text-muted">

                    {page} / {totalPages}

                  </span>

                  <button

                    type="button"

                    disabled={page >= totalPages || loading}

                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}

                    className="min-h-10 rounded-xl border border-subtle bg-elevated px-4 text-sm font-bold disabled:opacity-40"

                  >

                    {t('shop.nextPage')}

                  </button>

                </div>

              )}

            </>

          )}

        </div>

      )}



      {!error && !isBrowseHome && !isSearchMode && (

        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,240px)_1fr] lg:gap-6">

          <div className="hidden lg:block">

          <ShopSidebar

            categories={categories}

            brandGroups={brandGroups}

            categoryFilter={categoryFilter}

            brandFilter={brandFilter}

            offersOnly={offersOnly}

            onSelectCategory={selectCategory}

            onSelectBrand={(b) => {

              setPage(1);

              setBrandFilter(b);

              if (b) setOffersOnly(false);

            }}

            onToggleOffers={() => {

              setPage(1);

              setOffersOnly((v) => !v);

              setCategoryFilter(null);

              setBrandFilter(null);

            }}

          />

          </div>



          <div className={`${SHOP_PANEL} min-w-0 space-y-4`}>

            <nav className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted sm:text-sm">

              <button

                type="button"

                onClick={resetFilters}

                className="hover:text-primary transition-colors"

              >

                {t('shop.breadcrumbHome')}

              </button>

              <span className="text-faint">/</span>

              <span className="text-foreground font-bold">{resolvedCategoryTitle}</span>

            </nav>



            <div className="flex flex-wrap items-end justify-between gap-2">

              <h2 className="text-lg font-black sm:text-xl">{resolvedCategoryTitle}</h2>

              {resultsRangeLabel && !loading && (

                <p className="text-xs font-semibold text-muted">{resultsRangeLabel}</p>

              )}

            </div>



            {browseContext && subcategories.length > 0 && (

              <ShopSubcategoryStrip

                root={browseContext.root}

                subcategories={subcategories}

                activeSlug={browseContext.activeSlug}

                allLabel={allInCategoryLabel}

                label={categoryLabel}

                onSelect={(slug) => selectCategory(slug)}

              />

            )}



            {loading ? (

              <div className="space-y-4 min-w-0">

                <p className="text-primary animate-pulse text-sm">{t('shop.loading')}</p>

                <ShopProductSkeleton count={BROWSE_PER_PAGE} />

              </div>

            ) : products.length === 0 ? (

              <div className="glass-panel rounded-2xl p-10 text-center text-muted">{t('shop.empty')}</div>

            ) : (

              <>

                <motion.div

                  variants={staggerContainer(0.04)}

                  initial="hidden"

                  animate="visible"

                  className={SHOP_PRODUCT_GRID}

                >

                  {products.map((product) => (

                    <motion.div key={product.id} variants={itemVariants}>

                      <ShopProductCard

                        product={product}

                        productTo={productPagePath(product) ?? undefined}

                        onOpen={
                          productPagePath(product)
                            ? undefined
                            : () => openProductDetail(product.id)
                        }

                        onAdd={() => addFromCatalog(product)}

                        inStockLabel={t('marketplace.inStock')}

                        outOfStockLabel={t('shop.outOfStock')}

                        addLabel={t('shop.addToCart')}

                        saleBadgeLabel={

                          product.discountPercent

                            ? saleBadge(product.discountPercent)

                            : undefined

                        }

                      />

                    </motion.div>

                  ))}

                </motion.div>

                {totalPages > 1 && (

                  <div className="flex items-center justify-center gap-3 pt-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-2">

                    <button

                      type="button"

                      disabled={page <= 1 || loading}

                      onClick={() => setPage((p) => Math.max(1, p - 1))}

                      className="min-h-10 rounded-xl border border-subtle bg-elevated px-4 text-sm font-bold disabled:opacity-40"

                    >

                      {t('shop.prevPage')}

                    </button>

                    <span className="text-sm font-semibold text-muted">

                      {page} / {totalPages}

                    </span>

                    <button

                      type="button"

                      disabled={page >= totalPages || loading}

                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}

                      className="min-h-10 rounded-xl border border-subtle bg-elevated px-4 text-sm font-bold disabled:opacity-40"

                    >

                      {t('shop.nextPage')}

                    </button>

                  </div>

                )}

              </>

            )}

          </div>

        </div>

      )}



      <CartToast toast={toast} onDismiss={dismissToast} />

      {detailProductId ? (
        <ShopProductDetailModal
          productId={detailProductId}
          categories={categories}
          onClose={closeProductDetail}
          onAdd={(p) =>
            addFromCatalog(
              p,
              categoryFilter ? 'category' : offersOnly ? 'featured' : isSearchMode ? 'search' : 'direct'
            )
          }
          onBrowseCategory={(slug) => {
            closeProductDetail();
            selectCategory(slug);
          }}
          onHome={() => {
            closeProductDetail();
            resetFilters();
          }}
        />
      ) : null}

    </div>

  );

};


