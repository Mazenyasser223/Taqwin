import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import marketplaceService from '../../services/marketplaceService';
import { useCartStore } from '../../store/useCartStore';
import { useCartActions } from './useCartActions';
import { CartToast } from './CartToast';
import { buttonPress } from '../../lib/motion';
import {
  productComparePrice,
  productDisplayPrice,
} from '../../lib/shopFormat';
import {
  buildProductDescriptionSections,
  type DescriptionSection,
} from '../../lib/shopDescription';
import type { Product, ShopCategory } from '../../types';
import { buildCategoryBreadcrumb } from './shopBrowseUtils';
import { ProductGallery } from './ProductGallery';
import { ProductDescriptionSections } from './ProductDescriptionSections';
import { ProductInfoTabs } from './ProductInfoTabs';
import { RelatedProducts } from './RelatedProducts';
import { ProductRating } from '../commerce/ProductRating';
import { SHOP_SHELL } from './shopLayout';
import { WishlistButton } from '../commerce/WishlistButton';
import { ProductReviewsSection } from '../commerce/ProductReviewsSection';
import { SubscribePanel } from '../commerce/SubscribePanel';
import { trackShopFunnel } from '../../lib/shopFunnel';

function categoryLabel(cat: { nameEn: string; nameAr?: string | null }, language: string) {
  return language === 'ar' && cat.nameAr ? cat.nameAr : cat.nameEn;
}

export const ProductPage: React.FC = () => {
  const { slug: slugParam } = useParams<{ slug: string }>();
  const slug = slugParam ? decodeURIComponent(slugParam) : '';
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const cart = useCartStore();
  const { addToCart, toast, dismissToast } = useCartActions();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!slug) {
      setError(t('shop.productNotFound'));
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setQty(1);

    Promise.all([
      marketplaceService.getProductBySlug(slug),
      marketplaceService.getCategories(),
    ]).then(([prodRes, catRes]) => {
      if (cancelled) return;
      setLoading(false);
      if (!catRes.error && catRes.data) setCategories(catRes.data);
      if (prodRes.error || !prodRes.data) {
        setError(prodRes.error ?? t('shop.productNotFound'));
        setProduct(null);
        return;
      }
      setProduct(prodRes.data);
      void trackShopFunnel('product_view', { productId: prodRes.data.id });
    });

    return () => {
      cancelled = true;
    };
  }, [slug, t]);

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

  const handleAdd = () => {
    if (!product || product.stock <= 0) return;
    addToCart(product, qty, {
      source: product.isFeatured ? 'featured' : 'category',
    });
  };

  const browseCategory = (catSlug: string) => {
    navigate(`/marketplace?category=${encodeURIComponent(catSlug)}`);
  };

  return (
    <div className={`${SHOP_SHELL} space-y-6 pb-10 sm:space-y-8`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex min-w-0 flex-wrap items-center gap-1 text-xs font-semibold text-muted sm:text-sm">
          <Link to="/marketplace" className="hover:text-primary">
            {t('shop.breadcrumbHome')}
          </Link>
          {breadcrumb.map((crumb) => (
            <React.Fragment key={crumb.slug}>
              <span className="text-faint">/</span>
              <button
                type="button"
                onClick={() => browseCategory(crumb.slug)}
                className="truncate hover:text-primary max-w-[8rem] sm:max-w-none"
              >
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
          {product ? (
            <>
              <span className="text-faint">/</span>
              <span className="truncate font-bold text-foreground max-w-[12rem] sm:max-w-md">{title}</span>
            </>
          ) : null}
        </nav>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-1 rounded-xl border border-subtle px-3 py-2 text-xs font-bold text-muted hover:text-foreground"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {t('shop.backToShop')}
        </Link>
      </header>

      {loading ? (
        <div className="text-primary animate-pulse py-16 text-center">{t('shop.loading')}</div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-8 text-center">
          <p className="text-red-400">{error}</p>
          <Link
            to="/marketplace"
            className="mt-4 inline-block text-sm font-bold text-primary hover:underline"
          >
            {t('shop.backToShop')}
          </Link>
        </div>
      ) : product ? (
        <>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <ProductGallery
              images={product.imageUrl ? [product.imageUrl] : []}
              alt={title}
              saleDiscount={product.isOnSale ? saleDiscount : null}
            />

            <div className="flex flex-col gap-5 min-w-0">
              <div className="shop-product-info-card glass-panel overflow-hidden rounded-2xl border border-primary/30 shadow-[0_8px_32px_-8px_rgba(21,139,141,0.25)]">
                <div className="space-y-2 border-b border-subtle bg-gradient-to-br from-primary/15 via-[#13252d] to-[#13252d] px-5 py-4">
                  <p className="text-xs font-black uppercase tracking-widest text-accent">{product.brand}</p>
                  <h1 className="text-2xl font-black leading-tight text-foreground sm:text-3xl">{title}</h1>
                  <ProductRating
                    avgRating={product.avgRating}
                    reviewCount={product.reviewCount}
                    size="md"
                    className="mt-1"
                  />
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

              <div className="flex flex-wrap items-center gap-3">
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
                  onClick={handleAdd}
                  className="min-h-11 flex-1 min-w-[12rem] rounded-xl bg-[#f37021] px-6 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-[#f37021]/30 disabled:opacity-40 sm:flex-none"
                >
                  {t('shop.addToCart')}
                </motion.button>
                <Link
                  to="/marketplace/cart"
                  className="min-h-11 inline-flex items-center justify-center rounded-xl border border-subtle px-4 text-sm font-bold text-muted hover:text-foreground"
                >
                  {t('marketplace.cart', { count: String(cart.count()) })}
                </Link>
                <WishlistButton productId={product.id} />
              </div>

              <SubscribePanel product={product} />
            </div>
          </div>

          <ProductDescriptionSections
            sections={descSections}
            sectionTitle={sectionTitle}
          />

          <ProductInfoTabs product={product} descSections={descSections} />

          <ProductReviewsSection
            productId={product.id}
            avgRating={product.avgRating}
            reviewCount={product.reviewCount}
            onReviewSubmitted={() => {
              void marketplaceService.getProductBySlug(slug).then((res) => {
                if (res.data) setProduct(res.data);
              });
            }}
          />

          <RelatedProducts product={product} onAdd={addToCart} />
        </>
      ) : null}

      <CartToast toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default ProductPage;
