import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import marketplaceService from '../../../services/marketplaceService';
import type { Product, ShopCategory } from '../../../types';
import type { CatalogHint, CatalogPickItem, OnboardingAnswers } from '../types';
import { resolveCatalogPickName } from '../catalogLocale';
import { findCategoryBySlug } from '../../marketplace/shopHomeUtils';
import { browseSubcategories } from '../../marketplace/shopBrowseUtils';
import { stopStepSwipe } from './stepSwipe';

const SHOP_FALLBACK =
  'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600&q=80';

function stopSwipeDrag(e: React.PointerEvent) {
  e.stopPropagation();
}

function resolveProductTitle(product: Product, language: 'ar' | 'en'): string {
  return language === 'ar' && product.nameAr ? product.nameAr : product.name;
}

function parseSelections(raw: unknown): CatalogPickItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is CatalogPickItem =>
      x != null && typeof x === 'object' && 'id' in x && 'name' in x && 'catalog' in x,
  );
}

function ProductPickerRow({
  product,
  selected,
  language,
  onToggle,
  compact = false,
}: {
  product: Product;
  selected: boolean;
  language: 'ar' | 'en';
  onToggle: () => void;
  compact?: boolean;
}) {
  const title = resolveProductTitle(product, language);
  const img = product.imageUrl || SHOP_FALLBACK;
  const [imgSrc, setImgSrc] = useState(img);

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.99 }}
      className={`w-full flex items-center gap-2.5 rounded-xl border text-start transition-all ${
        compact ? 'px-2 py-2' : 'px-2.5 py-2.5'
      } ${
        selected
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-subtle bg-surface/50 hover:border-primary/35'
      }`}
    >
      <img
        src={imgSrc}
        alt=""
        className={`shrink-0 rounded-lg object-cover bg-black/20 ${compact ? 'size-10' : 'size-12'}`}
        loading="lazy"
        onError={() => setImgSrc(SHOP_FALLBACK)}
      />
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-foreground leading-snug line-clamp-2 ${compact ? 'text-xs' : 'text-sm'}`}>
          {title}
        </p>
        <p className="text-[10px] sm:text-[11px] text-faint mt-0.5 truncate">
          {product.brand}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-lg border flex items-center justify-center ${
          compact ? 'size-5' : 'size-6'
        } ${selected ? 'bg-primary border-primary' : 'border-subtle bg-background/50'}`}
      >
        {selected && (
          <span className={`material-symbols-outlined text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
            check
          </span>
        )}
      </span>
    </motion.button>
  );
}

export interface SupplementPickerStepProps {
  stepId: string;
  field?: string;
  shopCategorySlug?: string;
  multi?: boolean;
  maxSelect?: number;
  minSelect?: number;
  searchHints?: CatalogHint[];
  optional?: boolean;
  compact?: boolean;
  answers: OnboardingAnswers;
  onAnswer: (stepId: string, value: CatalogPickItem[] | string) => void;
  onContinue: (pending?: OnboardingAnswers) => void;
  hideContinue?: boolean;
}

export const SupplementPickerStep: React.FC<SupplementPickerStepProps> = ({
  stepId,
  field,
  shopCategorySlug = 'supplements',
  multi = true,
  maxSelect = 12,
  minSelect = 0,
  searchHints = [],
  optional = false,
  compact = false,
  answers,
  onAnswer,
  onContinue,
  hideContinue = false,
}) => {
  const { t, language } = useI18n();
  const answerKey = field ?? stepId;
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [shopCategories, setShopCategories] = useState<ShopCategory[]>([]);
  const [activeSlug, setActiveSlug] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const loadGen = useRef(0);

  const selected = useMemo(() => parseSelections(answers[answerKey] ?? answers[stepId]), [answers, answerKey, stepId]);
  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  const supplementsRoot = useMemo(
    () => findCategoryBySlug(shopCategories, shopCategorySlug),
    [shopCategories, shopCategorySlug],
  );

  const subcategories = useMemo(
    () => (supplementsRoot ? browseSubcategories(supplementsRoot) : []),
    [supplementsRoot],
  );

  const categoryLabel = useCallback(
    (cat: { nameEn: string; nameAr?: string | null }) =>
      language === 'ar' && cat.nameAr ? cat.nameAr : cat.nameEn,
    [language],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 320);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setCategoriesError(null);
    marketplaceService.getCategories(45000).then((res) => {
      if (res.error) {
        setCategoriesError(res.error);
        return;
      }
      if (res.data) setShopCategories(res.data);
    });
  }, [reloadKey]);

  useEffect(() => {
    setSearch('');
    setDebounced('');
    setActiveSlug('');
  }, [stepId]);

  const loadProducts = useCallback(async () => {
    const gen = ++loadGen.current;
    setLoading(true);
    setError(null);

    const res = await marketplaceService.getProducts({
      category: activeSlug || shopCategorySlug,
      search: debounced || undefined,
      limit: 24,
      timeoutMs: 45000,
    });

    if (gen !== loadGen.current) return;
    if (res.error) setError(res.error);
    else setProducts(res.data?.items ?? []);
    setLoading(false);
  }, [activeSlug, debounced, shopCategorySlug, reloadKey]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const toggleProduct = (product: Product) => {
    const item: CatalogPickItem = {
      id: product.id,
      name: product.name,
      nameAr: product.nameAr ?? null,
      nameEn: product.name,
      imageUrl: product.imageUrl || SHOP_FALLBACK,
      catalog: 'supplement',
    };

    if (!multi) {
      onAnswer(answerKey, [item]);
      return;
    }
    if (selectedIds.has(product.id)) {
      onAnswer(answerKey, selected.filter((s) => s.id !== product.id));
      return;
    }
    if (selected.length >= maxSelect) return;
    onAnswer(answerKey, [...selected, item]);
  };

  const applyHint = (hint: CatalogHint) => {
    setSearch(hint.query);
    if (hint.categoryId) setActiveSlug(hint.categoryId);
  };

  const canContinue = optional ? true : selected.length >= Math.max(minSelect, 1);
  const showSkipLabel = optional && selected.length === 0;
  const loadError = error ?? categoriesError;

  const scrollPanelClass = compact
    ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar pe-0.5'
    : 'max-h-[min(50vh,420px)] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar pe-0.5';

  return (
    <div
      className={`font-[Cairo,'Space_Grotesk',sans-serif] ${
        compact ? 'flex flex-col flex-1 min-h-0 gap-1.5' : 'space-y-3'
      }`}
    >
      <p className="text-[11px] sm:text-xs text-primary/90 font-bold text-center shrink-0 px-1">
        {t('onboarding.catalog.shopSupplementsHint')}
      </p>

      {selected.length > 0 && (
        <div
          className="flex gap-1.5 overflow-x-auto pb-0.5 shrink-0 custom-scrollbar touch-pan-x"
          onPointerDown={stopSwipeDrag}
        >
          {selected.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onAnswer(answerKey, selected.filter((s) => s.id !== item.id))}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/25 pl-1 pr-1.5 py-0.5 hover:border-red-400/50"
            >
              <img src={item.imageUrl || SHOP_FALLBACK} alt="" className="size-7 rounded-md object-cover" />
              <span className="text-[11px] font-bold max-w-[5.5rem] truncate">
                {resolveCatalogPickName(item, language)}
              </span>
              <span className="material-symbols-outlined text-xs text-faint">close</span>
            </button>
          ))}
        </div>
      )}

      <div className={compact ? 'flex flex-1 min-h-0 flex-col gap-1.5' : undefined}>
        <div className="relative shrink-0">
          <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-faint text-lg">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('onboarding.catalog.searchSupplements')}
            className={`w-full rounded-2xl border border-subtle bg-surface/80 ps-10 pe-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              compact ? 'py-2' : 'py-3'
            }`}
          />
        </div>

        {searchHints.length > 0 && (
          <div
            className={`flex flex-wrap shrink-0 ${compact ? 'gap-1' : 'gap-2'}`}
            onPointerDown={stopSwipeDrag}
          >
            {searchHints.map((hint) => (
              <button
                key={hint.label}
                type="button"
                onClick={() => applyHint(hint)}
                className={`font-bold rounded-full border border-subtle bg-elevated/60 hover:border-primary/40 hover:text-primary ${
                  compact ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1.5'
                }`}
              >
                {hint.label}
              </button>
            ))}
          </div>
        )}

        {subcategories.length > 0 && (
          <div
            className={`flex overflow-x-auto custom-scrollbar -mx-1 px-1 shrink-0 touch-pan-x ${
              compact ? 'gap-1 pb-0' : 'gap-2 pb-1'
            }`}
            onPointerDown={stopSwipeDrag}
          >
            <button
              type="button"
              onClick={() => setActiveSlug('')}
              className={`shrink-0 rounded-xl border font-bold ${
                compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
              } ${!activeSlug ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface/60'}`}
            >
              {t('onboarding.catalog.allSupplements')}
            </button>
            {subcategories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setActiveSlug(cat.slug)}
                className={`shrink-0 rounded-xl border font-bold ${
                  compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
                } ${
                  activeSlug === cat.slug
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-subtle bg-surface/60'
                }`}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>
        )}

        {loadError && (
          <div className="flex flex-col items-center gap-2 shrink-0 px-2">
            <p className="text-sm text-red-400 text-center">{loadError}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCategoriesError(null);
                setReloadKey((k) => k + 1);
              }}
              className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/15"
            >
              {t('onboarding.catalog.retry')}
            </button>
          </div>
        )}

        <div className={compact ? 'flex-1 min-h-0 flex flex-col' : undefined}>
          {loading ? (
            <p
              className={`text-sm text-faint text-center animate-pulse ${
                compact ? 'flex-1 flex items-center justify-center min-h-0' : 'py-8 shrink-0'
              }`}
            >
              {t('onboarding.catalog.loading')}
            </p>
          ) : loadError ? null : products.length === 0 ? (
            <p
              className={`text-sm text-faint text-center ${
                compact ? 'flex-1 flex items-center justify-center min-h-0' : 'py-8 shrink-0'
              }`}
            >
              {t('onboarding.catalog.empty')}
            </p>
          ) : (
            <motion.div
              layout
              className={`flex flex-col gap-1.5 ${scrollPanelClass}`}
              onPointerDown={stopSwipeDrag}
            >
              <AnimatePresence mode="popLayout">
                {products.map((product) => (
                  <ProductPickerRow
                    key={product.id}
                    product={product}
                    language={language}
                    selected={selectedIds.has(product.id)}
                    onToggle={() => toggleProduct(product)}
                    compact={compact}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {!hideContinue && (
        <motion.button
          type="button"
          disabled={!canContinue}
          onPointerDown={stopStepSwipe}
          onTap={() => {
            if (!canContinue) return;
            onContinue({ [answerKey]: selected });
          }}
          whileTap={canContinue ? { scale: 0.98 } : undefined}
          className={`w-full rounded-2xl bg-primary text-white font-black text-sm disabled:opacity-40 shadow-lg shadow-primary/20 ${
            compact ? 'shrink-0 mt-auto py-3' : 'py-3.5'
          }`}
        >
          {showSkipLabel ? t('onboarding.catalog.skipStep') : t('common.continue')}
        </motion.button>
      )}
    </div>
  );
};
