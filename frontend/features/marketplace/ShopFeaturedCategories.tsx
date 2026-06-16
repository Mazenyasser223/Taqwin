import React, { useMemo } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { ShopCategory } from '../../types';
import { pickFeaturedCategories } from './shopHomeUtils';

interface ShopFeaturedCategoriesProps {
  categories: ShopCategory[];
  labelFor: (cat: { nameEn: string; nameAr?: string | null }) => string;
  isAllSelected: boolean;
  categoryFilter: string | null;
  onSelectAll: () => void;
  onSelectCategory: (slug: string) => void;
}

export const ShopFeaturedCategories: React.FC<ShopFeaturedCategoriesProps> = ({
  categories,
  labelFor,
  isAllSelected,
  categoryFilter,
  onSelectAll,
  onSelectCategory,
}) => {
  const { t } = useI18n();
  const featured = useMemo(() => pickFeaturedCategories(categories), [categories]);

  if (featured.length === 0) return null;

  const cardClass = (active: boolean) =>
    `group flex min-h-[88px] flex-col items-start gap-2 rounded-2xl border p-3.5 text-start transition sm:min-h-[96px] sm:p-4 ${
      active
        ? 'border-primary bg-primary/10 ring-2 ring-primary/25 shadow-sm shadow-primary/10'
        : 'border-subtle bg-elevated/80 hover:border-primary/35 hover:bg-elevated-hover'
    }`;

  return (
    <section className="min-w-0 space-y-4" aria-labelledby="shop-featured-categories">
      <div>
        <h2 id="shop-featured-categories" className="text-lg font-black text-foreground sm:text-xl">
          {t('shop.featuredCategories')}
        </h2>
        <p className="mt-0.5 text-sm text-muted">{t('shop.featuredCategoriesHint')}</p>
      </div>

      <div className="shop-featured-grid grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:gap-4">
        <button
          type="button"
          onClick={onSelectAll}
          aria-pressed={isAllSelected}
          className={cardClass(isAllSelected)}
        >
          <span
            className={`flex size-10 items-center justify-center rounded-xl transition ${
              isAllSelected
                ? 'bg-primary text-white'
                : 'bg-primary/10 text-primary group-hover:bg-primary/15'
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">apps</span>
          </span>
          <span className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
            {t('shop.allCategories')}
          </span>
        </button>

        {featured.map((cat) => (
          <button
            key={cat.slug}
            type="button"
            onClick={() => onSelectCategory(cat.slug)}
            aria-pressed={categoryFilter === cat.slug}
            className={cardClass(categoryFilter === cat.slug)}
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
