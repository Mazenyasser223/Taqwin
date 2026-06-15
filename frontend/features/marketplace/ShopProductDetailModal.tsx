import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import marketplaceService from '../../services/marketplaceService';
import { buttonPress } from '../../lib/motion';
import {
  formatShopPrice,
  productComparePrice,
  productDisplayPrice,
} from '../../lib/shopFormat';
import {
  buildProductDescriptionSections,
  type DescriptionSection,
} from '../../lib/shopDescription';
import type { Product, ShopCategory } from '../../types';
import { buildCategoryBreadcrumb } from './shopBrowseUtils';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1593094859027-e9623c44810a?q=80&w=800';

interface ShopProductDetailModalProps {
  productId: string;
  categories: ShopCategory[];
  onClose: () => void;
  onAdd: (product: Product, qty: number) => void;
  onBrowseCategory?: (slug: string) => void;
  onHome?: () => void;
}

function categoryLabel(cat: { nameEn: string; nameAr?: string | null }, language: string) {
  return language === 'ar' && cat.nameAr ? cat.nameAr : cat.nameEn;
}

export const ShopProductDetailModal: React.FC<ShopProductDetailModalProps> = ({
  productId,
  categories,
  onClose,
  onAdd,
  onBrowseCategory,
  onHome,
}) => {
  const { t, language } = useI18n();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setQty(1);
    marketplaceService.getProduct(productId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setError(res.error ?? t('shop.loadFailed'));
        setProduct(null);
        return;
      }
      setProduct(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [productId, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title = useMemo(() => {
    if (!product) return '';
    return language === 'ar' && product.nameAr ? product.nameAr : product.name;
  }, [product, language]);

  const descriptionMessages = useMemo(
    () => ({
      fallbackDescription: t('shop.fallbackDescription'),
      highlightInStock: t('shop.highlightInStock'),
      highlightOutOfStock: t('shop.highlightOutOfStock'),
      highlightBrand: t('shop.highlightBrand'),
      highlightCategory: t('shop.highlightCategory'),
      highlightPrice: t('shop.highlightPrice'),
      howToReview: t('shop.howToReview'),
      howToUseAsDirected: t('shop.howToUseAsDirected'),
      howToStore: t('shop.howToStore'),
    }),
    [t]
  );

  const descSections = useMemo(() => {
    if (!product) return [];
    return buildProductDescriptionSections(
      product,
      language,
      descriptionMessages,
      (cat) => categoryLabel(cat, language)
    );
  }, [product, language, descriptionMessages]);

  const breadcrumb = useMemo(() => {
    if (!product?.category?.slug) return [];
    const chain = buildCategoryBreadcrumb(categories, product.category.slug, (cat) =>
      categoryLabel(cat, language)
    );
    if (chain.length) return chain;
    if (product.category) {
      return [
        {
          label: categoryLabel(product.category, language),
          slug: product.category.slug,
        },
      ];
    }
    return [];
  }, [product, categories, language]);

  const saleDiscount =
    product?.discountPercent ??
    (product?.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : null);

  const sectionTitle = (id: DescriptionSection['id']) => {
    if (id === 'howToUse') return t('shop.howToUse');
    if (id === 'keyHighlights') return t('shop.keyHighlights');
    return t('shop.descriptionTitle');
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex flex-col bg-background/95 backdrop-blur-md safe-top safe-bottom"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-product-detail-title"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-subtle px-4 py-3 sm:px-6">
          <nav className="flex min-w-0 flex-wrap items-center gap-1 text-xs font-semibold text-muted sm:text-sm">
            <button type="button" onClick={() => onHome?.()} className="hover:text-primary">
              {t('shop.breadcrumbHome')}
            </button>
            {breadcrumb.map((crumb) => (
              <React.Fragment key={crumb.slug ?? crumb.label}>
                <span className="text-faint">/</span>
                <button
                  type="button"
                  onClick={() => crumb.slug && onBrowseCategory?.(crumb.slug)}
                  className="truncate hover:text-primary max-w-[8rem] sm:max-w-none"
                >
                  {crumb.label}
                </button>
              </React.Fragment>
            ))}
            {product ? (
              <>
                <span className="text-faint">/</span>
                <span className="truncate text-foreground font-bold max-w-[10rem] sm:max-w-xs">
                  {title}
                </span>
              </>
            ) : null}
          </nav>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-white/10 bg-zinc-900/95 p-2 text-zinc-300 shadow-lg hover:bg-zinc-800 hover:text-white"
            aria-label={t('shop.closeDetail')}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-6 sm:px-8">
          {loading ? (
            <div className="text-primary animate-pulse py-16 text-center">{t('shop.loading')}</div>
          ) : error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
              {error}
            </div>
          ) : product ? (
            <div className="mx-auto max-w-6xl space-y-10">
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <div className="relative overflow-hidden rounded-2xl border border-subtle bg-elevated/50 aspect-square max-h-[min(70vh,520px)]">
                  {product.isOnSale && saleDiscount ? (
                    <span className="absolute top-4 start-4 z-10 rounded-lg bg-[#f37021] px-3 py-1 text-xs font-black uppercase text-white shadow-lg">
                      -{saleDiscount}%
                    </span>
                  ) : null}
                  <img
                    src={product.imageUrl || FALLBACK_IMG}
                    alt=""
                    className="h-full w-full object-contain p-6"
                  />
                </div>

                <div className="flex flex-col gap-5 min-w-0">
                  <div className="shop-product-info-card glass-panel overflow-hidden rounded-2xl border border-primary/30 shadow-[0_8px_32px_-8px_rgba(21,139,141,0.25)]">
                    <div className="space-y-2 border-b border-subtle bg-gradient-to-br from-primary/15 via-[#13252d] to-[#13252d] px-5 py-4">
                      <p className="text-xs font-black uppercase tracking-widest text-accent">
                        {product.brand}
                      </p>
                      <h1
                        id="shop-product-detail-title"
                        className="text-2xl font-black leading-tight text-foreground sm:text-3xl"
                      >
                        {title}
                      </h1>
                    </div>

                    <dl className="divide-y divide-subtle text-sm">
                      <div className="flex justify-between gap-4 bg-black/15 px-5 py-3">
                        <dt className="font-semibold text-muted">{t('shop.brandLabel')}</dt>
                        <dd className="font-bold text-end text-foreground">{product.brand}</dd>
                      </div>
                      {product.category ? (
                        <div className="flex justify-between gap-4 bg-black/15 px-5 py-3">
                          <dt className="font-semibold text-muted">{t('shop.categoryLabel')}</dt>
                          <dd className="font-bold text-end text-foreground">
                            {categoryLabel(product.category, language)}
                          </dd>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-4 bg-black/15 px-5 py-3">
                        <dt className="font-semibold text-muted">{t('shop.detailStock')}</dt>
                        <dd
                          className={`font-bold text-end ${
                            product.stock > 0 ? 'text-emerald-500' : 'text-muted'
                          }`}
                        >
                          {product.stock > 0 ? t('marketplace.inStock') : t('shop.outOfStock')}
                        </dd>
                      </div>
                      {product.hasVariants ? (
                        <div className="flex justify-between gap-4 bg-black/15 px-5 py-3">
                          <dt className="font-semibold text-muted">{t('shop.detailVariants')}</dt>
                          <dd className="font-bold text-end text-muted">{t('shop.variantsNote')}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="text-2xl font-black text-[#f37021] sm:text-3xl">
                      {productDisplayPrice(product, language)}
                    </span>
                    {productComparePrice(product, language) ? (
                      <span className="text-lg text-muted line-through">
                        {productComparePrice(product, language)}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <div className="flex items-center rounded-xl border border-subtle bg-elevated">
                      <button
                        type="button"
                        className="min-h-11 min-w-11 text-lg font-bold text-muted hover:text-foreground"
                        onClick={() => setQty((q) => Math.max(1, q - 1))}
                        aria-label={t('shop.decreaseQty')}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
                        className="w-12 border-x border-subtle bg-transparent py-2 text-center text-sm font-black"
                      />
                      <button
                        type="button"
                        className="min-h-11 min-w-11 text-lg font-bold text-muted hover:text-foreground"
                        onClick={() => setQty((q) => Math.min(99, q + 1))}
                        aria-label={t('shop.increaseQty')}
                      >
                        +
                      </button>
                    </div>
                    <motion.button
                      type="button"
                      variants={buttonPress}
                      whileHover="hover"
                      whileTap="tap"
                      disabled={product.stock <= 0}
                      onClick={() => onAdd(product, qty)}
                      className="min-h-11 flex-1 min-w-[12rem] rounded-xl bg-[#f37021] px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-[#f37021]/30 disabled:opacity-40 sm:flex-none"
                    >
                      {t('shop.addToCart')}
                    </motion.button>
                  </div>
                </div>
              </div>

              <div className="space-y-5 border-t border-subtle pt-8">
                {descSections.map((section) => (
                  <section
                    key={section.id}
                    className="shop-product-section-card max-w-3xl overflow-hidden rounded-2xl border border-primary/25 shadow-[0_8px_32px_-8px_rgba(21,139,141,0.2)]"
                  >
                    <div className="flex flex-wrap items-center gap-2 border-b border-subtle/50 px-5 py-4">
                      <h2 className="text-xl font-black text-foreground">
                        {sectionTitle(section.id)}
                      </h2>
                      {section.isFallback ? (
                        <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                          {t('shop.standardInfo')}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="shop-product-prose px-5 py-4 text-sm leading-relaxed text-muted [&_h2]:text-lg [&_h2]:font-black [&_h2]:text-foreground [&_h3]:font-bold [&_h3]:text-foreground [&_li]:mb-2 [&_p]:mb-3 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:ps-5"
                      dangerouslySetInnerHTML={{ __html: section.html }}
                    />
                  </section>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
