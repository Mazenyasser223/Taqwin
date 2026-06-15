import React, { useMemo } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { ShopCategory } from '../../types';
import { pickFeaturedCategories } from './shopHomeUtils';

interface ShopFeaturedCategoriesProps {
  categories: ShopCategory[];
  labelFor: (cat: { nameEn: string; nameAr?: string | null }) => string;
  onSelectCategory: (slug: string) => void;
  onBrowseAll: () => void;
}

export const ShopFeaturedCategories: React.FC<ShopFeaturedCategoriesProps> = ({
  categories,
  labelFor,
  onSelectCategory,
  onBrowseAll,
}) => {
  const { t } = useI18n();
  const featured = useMemo(() => pickFeaturedCategories(categories), [categories]);

  if (featured.length === 0) return null;

  return (
    <section className="min-w-0 space-y-4" aria-labelledby="shop-featured-categories">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="shop-featured-categories" className="text-lg font-black text-foreground sm:text-xl">
            {t('shop.featuredCategories')}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{t('shop.featuredCategoriesHint')}</p>
        </div>
        <button
          type="button"
          onClick={onBrowseAll}
          className="shrink-0 text-xs font-bold text-primary hover:underline sm:text-sm"
        >
          {t('shop.browseAllCategories')}
        </button>
      </div>

      <div className="shop-featured-grid grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:gap-4">
        {featured.map((cat) => (
          <button
            key={cat.slug}
            type="button"
            onClick={() => onSelectCategory(cat.slug)}
            className="group flex min-h-[88px] flex-col items-start gap-2 rounded-2xl border border-subtle bg-elevated/80 p-3.5 text-start transition hover:border-primary/35 hover:bg-elevated-hover sm:min-h-[96px] sm:p-4"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary/15">
              <span className="material-symbols-outlined text-[22px]">{cat.icon || 'category'}</span>
            </span>
            <span className="line-clamp-2 text-sm font-bold leading-snug text-foreground">{labelFor(cat)}</span>
            {(cat.productCount ?? 0) > 0 ? (
              <span className="text-[10px] font-semibold text-muted">
                {t('shop.productCount', { count: String(cat.productCount) })}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
};
