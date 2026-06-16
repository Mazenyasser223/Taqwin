import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { ShopCategory } from '../../types';
import { SHOP_QUICK_FILTER_SLUGS, findCategoryBySlug } from './shopHomeUtils';

interface ShopQuickFiltersProps {
  categories: ShopCategory[];
  isBrowseHome: boolean;
  offersOnly: boolean;
  categoryFilter: string | null;
  onSelectHome: () => void;
  onToggleOffers: () => void;
  onSelectCategory: (slug: string) => void;
  labelFor: (cat: { nameEn: string; nameAr?: string | null }) => string;
}

function FilterChip({
  active,
  icon,
  children,
  onClick,
}: {
  active: boolean;
  icon?: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition sm:text-sm ${
        active
          ? 'border-primary bg-primary text-white shadow-sm shadow-primary/20'
          : 'border-subtle bg-elevated text-muted hover:border-primary/30 hover:text-foreground'
      }`}
    >
      {icon ? (
        <span className="material-symbols-outlined text-[16px] sm:text-[18px]">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

export const ShopQuickFilters: React.FC<ShopQuickFiltersProps> = ({
  categories,
  isBrowseHome,
  offersOnly,
  categoryFilter,
  onSelectHome,
  onToggleOffers,
  onSelectCategory,
  labelFor,
}) => {
  const { t } = useI18n();

  const quickCats = SHOP_QUICK_FILTER_SLUGS.map((slug) => findCategoryBySlug(categories, slug)).filter(
    (c): c is ShopCategory => Boolean(c && (c.productCount ?? 0) > 0),
  );

  return (
    <div
      className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar snap-x snap-mandatory"
      aria-label={t('shop.quickFilters')}
    >
      <FilterChip active={isBrowseHome} icon="apps" onClick={onSelectHome}>
        {t('shop.allCategories')}
      </FilterChip>
      <FilterChip active={offersOnly} icon="local_offer" onClick={onToggleOffers}>
        {t('shop.offersOnly')}
      </FilterChip>
      {quickCats.map((cat) => (
        <FilterChip
          key={cat.slug}
          active={categoryFilter === cat.slug && !offersOnly}
          icon={cat.icon || 'category'}
          onClick={() => onSelectCategory(cat.slug)}
        >
          {labelFor(cat)}
        </FilterChip>
      ))}
    </div>
  );
};
