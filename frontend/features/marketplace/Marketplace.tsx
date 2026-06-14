import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useI18n } from '../../lib/i18n/useI18n';

import { motion, AnimatePresence } from 'framer-motion';

import {

  staggerContainer,

  itemVariants,

  buttonPress,

  snapTransition,

} from '../../lib/motion';

import { Magnetic } from '../../components/shared/MotionWrappers';

import marketplaceService from '../../services/marketplaceService';

import { useCartStore } from '../../store/useCartStore';

import type { Product, ShopCategory } from '../../types';

import { ShopCategoryTile } from './ShopCategoryTile';

import { ShopProductCard } from './ShopProductCard';

import { ShopProductSection } from './ShopProductSection';

import { ShopSidebar } from './ShopSidebar';

import { ShopSubcategoryStrip } from './ShopSubcategoryStrip';

import { ShopProductSkeleton } from './ShopProductSkeleton';
import { ShopProductDetailModal } from './ShopProductDetailModal';

import { formatShopPrice } from '../../lib/shopFormat';

import { groupByBrand } from './shopUtils';

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
  const navigate = useNavigate();
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

  const [showCart, setShowCart] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const [brandFilter, setBrandFilter] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const [offersOnly, setOffersOnly] = useState(false);



  const cart = useCartStore();

  const isBrowseHome = !categoryFilter && !brandFilter && !offersOnly;



  const brandGroups = useMemo(() => groupByBrand(products), [products]);



  const loadHomeSections = useCallback(async (cats: ShopCategory[]) => {

    const roots = cats.filter((c) => (c.productCount ?? 0) > 0);

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

  }, [brandFilter, categoryFilter, offersOnly, page, isBrowseHome, t]);



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



  const handleCheckout = () => {
    if (cart.items.length === 0) return;
    setShowCart(false);
    navigate('/checkout');
  };



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

  const addProduct = (product: Product, qty = 1) => {
    cart.add(product, qty);
    setToast(t('marketplace.added', { name: product.name }));
    setTimeout(() => setToast(null), 1500);
  };



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



  const cartLinePrice = (p: Product) =>

    formatShopPrice(p.price, p.currency ?? 'EGP', language);



  const cartTotal = () =>

    formatShopPrice(cart.total(), cart.items[0]?.product.currency ?? 'EGP', language);



  const resetFilters = () => {

    setPage(1);

    setCategoryFilter(null);

    setBrandFilter(null);

    setOffersOnly(false);

  };



  const selectCategory = (slug: string | null) => {

    setPage(1);

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



  return (

    <div className="page-shell athlete-dashboard min-w-0">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <motion.div

          initial={{ opacity: 0, y: 12 }}

          animate={{ opacity: 1, y: 0 }}

          transition={snapTransition}

        >

          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{t('shop.title')}</h1>

          <p className="text-muted mt-1 text-sm">{t('shop.subtitle')}</p>

        </motion.div>

        <div className="flex flex-wrap items-center gap-2">

          <Link

            to="/orders"

            className="min-h-10 rounded-xl border border-subtle bg-elevated px-4 py-2.5 text-sm font-bold"

          >

            {t('marketplace.viewOrders')}

          </Link>

          <Magnetic>

            <motion.button

              variants={buttonPress}

              whileHover="hover"

              whileTap="tap"

              onClick={() => setShowCart(true)}

              className="min-h-10 rounded-xl border border-border bg-surface/60 px-5 py-2.5 text-sm font-black flex items-center gap-2"

            >

              <span className="material-symbols-outlined text-primary">shopping_bag</span>

              {t('marketplace.cart', { count: String(cart.count()) })}

            </motion.button>

          </Magnetic>

        </div>

      </div>



      <div className="rounded-xl border border-[#f37021]/30 bg-gradient-to-r from-[#f37021]/12 via-transparent to-[#158b8d]/10 px-4 py-2.5 text-xs font-bold flex items-center gap-2 sm:text-sm">

        <span className="material-symbols-outlined text-[#f37021] text-lg">local_shipping</span>

        {t('shop.freeShipping')}

      </div>



      {toast && (

        <div className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">

          {toast}

        </div>

      )}



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



      {categories.length > 0 && (

        <section className="min-w-0 space-y-2">

          <h2 className="text-xs font-black uppercase tracking-widest text-faint px-0.5">

            {t('shop.shopByCategory')}

          </h2>

          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar snap-x snap-mandatory">

            <ShopCategoryTile

              category={{ id: 'all', slug: 'all', nameEn: t('shop.allCategories'), icon: 'apps' }}

              name={t('shop.allCategories')}

              selected={isBrowseHome}

              onSelect={resetFilters}

            />

            {categories.map((cat) => (

              <ShopCategoryTile

                key={cat.slug}

                category={cat}

                name={categoryLabel(cat)}

                selected={categoryFilter === cat.slug && !offersOnly}

                onSelect={() => selectCategory(cat.slug)}

              />

            ))}

          </div>

        </section>

      )}



      {!categoriesLoading && !error && isBrowseHome && (

        <div className="space-y-8 min-w-0">

          {homeOffers.length > 0 && (

            <ShopProductSection

              title={t('shop.offersSection')}

              products={homeOffers}

              viewAllLabel={t('shop.viewAll')}

              onViewAll={() => {

                setPage(1);

                setOffersOnly(true);

                setCategoryFilter(null);

                setBrandFilter(null);

              }}

              onAdd={addProduct}
              onOpen={(p) => openProductDetail(p.id)}

              inStockLabel={t('marketplace.inStock')}

              outOfStockLabel={t('shop.outOfStock')}

              addLabel={t('shop.addToCart')}

              saleBadgeLabel={saleBadge}

            />

          )}

          {homeSections.map(({ cat, products: sectionProducts }) => (

            <ShopProductSection

              key={cat.slug}

              title={categoryLabel(cat)}

              products={sectionProducts}

              viewAllLabel={t('shop.viewAll')}

              onViewAll={() => selectCategory(cat.slug)}

              onAdd={addProduct}
              onOpen={(p) => openProductDetail(p.id)}

              inStockLabel={t('marketplace.inStock')}

              outOfStockLabel={t('shop.outOfStock')}

              addLabel={t('shop.addToCart')}

              saleBadgeLabel={saleBadge}

            />

          ))}

          {homeSectionsLoading && (

            <div className="text-primary animate-pulse text-sm py-2">{t('shop.loading')}</div>

          )}

          {!homeLoading && homeOffers.length === 0 && homeSections.length === 0 && !homeSectionsLoading && (

            <div className="glass-panel rounded-2xl p-10 text-center text-muted">{t('shop.empty')}</div>

          )}

        </div>

      )}



      {!error && !isBrowseHome && (

        <div className="grid gap-6 lg:grid-cols-[minmax(200px,240px)_1fr] min-w-0">

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



          <div className="min-w-0 space-y-4">

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

                  className="grid grid-cols-2 gap-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:grid-cols-3 sm:pb-2 xl:grid-cols-4"

                >

                  {products.map((product) => (

                    <motion.div key={product.id} variants={itemVariants}>

                      <ShopProductCard

                        product={product}

                        onOpen={() => openProductDetail(product.id)}

                        onAdd={() => addProduct(product)}

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



      <AnimatePresence>

        {showCart && (

          <motion.div

            initial={{ opacity: 0 }}

            animate={{ opacity: 1 }}

            exit={{ opacity: 0 }}

            className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center sm:p-6 safe-bottom"

            onClick={() => setShowCart(false)}

          >

            <motion.div

              initial={{ y: 40, opacity: 0 }}

              animate={{ y: 0, opacity: 1 }}

              exit={{ y: 40, opacity: 0 }}

              onClick={(e) => e.stopPropagation()}

              className="glass-panel flex max-h-[min(90dvh,85vh)] w-full max-w-lg flex-col space-y-5 rounded-t-3xl p-6 sm:rounded-3xl sm:p-8"

            >

              <div className="flex items-center justify-between">

                <h3 className="text-xl font-black">{t('marketplace.cartTitle')}</h3>

                <button type="button" onClick={() => setShowCart(false)} className="text-muted">

                  <span className="material-symbols-outlined">close</span>

                </button>

              </div>



              {cart.items.length === 0 ? (

                <p className="py-12 text-center text-muted">{t('marketplace.cartEmpty')}</p>

              ) : (

                <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">

                  {cart.items.map((item) => (

                    <div

                      key={item.product.id}

                      className="flex items-center gap-3 rounded-xl border border-subtle bg-elevated p-3"

                    >

                      <img

                        src={item.product.imageUrl || FALLBACK_IMG}

                        alt=""

                        className="size-14 rounded-lg object-cover"

                      />

                      <div className="min-w-0 flex-1">

                        <p className="truncate font-bold text-sm">{item.product.name}</p>

                        <p className="text-xs text-muted">

                          {item.product.brand} · {cartLinePrice(item.product)}

                        </p>

                      </div>

                      <input

                        type="number"

                        min={1}

                        value={item.quantity}

                        onChange={(e) =>

                          cart.setQuantity(item.product.id, Number(e.target.value) || 1)

                        }

                        className="w-14 rounded-lg border border-subtle bg-elevated px-1 py-1 text-center text-sm font-bold"

                      />

                      <button

                        type="button"

                        onClick={() => cart.remove(item.product.id)}

                        className="text-muted hover:text-red-400"

                      >

                        <span className="material-symbols-outlined">delete</span>

                      </button>

                    </div>

                  ))}

                </div>

              )}



              <div className="space-y-3 border-t border-subtle pt-4">

                <div className="flex justify-between text-lg font-bold">

                  <span>{t('marketplace.total')}</span>

                  <span>{cartTotal()}</span>

                </div>

                <motion.button

                  variants={buttonPress}

                  whileHover="hover"

                  whileTap="tap"

                  onClick={handleCheckout}

                  disabled={cart.items.length === 0}

                  className="w-full rounded-2xl bg-primary py-3.5 font-black text-white disabled:opacity-50"

                >

                  {t('marketplace.checkout')}

                </motion.button>

              </div>

            </motion.div>

          </motion.div>

        )}

      </AnimatePresence>

      {detailProductId ? (
        <ShopProductDetailModal
          productId={detailProductId}
          categories={categories}
          onClose={closeProductDetail}
          onAdd={addProduct}
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


