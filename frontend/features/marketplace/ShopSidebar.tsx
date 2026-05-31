import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { Product, ShopCategory, ShopCategoryChild } from '../../types';

interface ShopSidebarProps {
  categories: ShopCategory[];
  brandGroups: { brand: string; items: Product[] }[];
  categoryFilter: string | null;
  brandFilter: string | null;
  offersOnly: boolean;
  onSelectCategory: (slug: string | null) => void;
  onSelectBrand: (brand: string | null) => void;
  onToggleOffers: () => void;
}

function containsSlug(node: ShopCategoryChild, slug: string): boolean {
  if (node.slug === slug) return true;
  return Boolean(node.children?.some((c) => containsSlug(c, slug)));
}

function CategoryBranch({
  cat,
  depth,
  categoryFilter,
  offersOnly,
  label,
  navBtn,
  onSelectCategory,
  t,
}: {
  cat: ShopCategoryChild;
  depth: number;
  categoryFilter: string | null;
  offersOnly: boolean;
  label: (c: { nameEn: string; nameAr?: string | null }) => string;
  navBtn: (active: boolean) => string;
  onSelectCategory: (slug: string) => void;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  const open = containsSlug(cat, categoryFilter || '');
  return (
    <div className={depth > 0 ? 'ms-3 border-s border-primary/15 ps-2' : ''}>
      <button
        type="button"
        className={navBtn(categoryFilter === cat.slug && !offersOnly)}
        onClick={() => onSelectCategory(cat.slug)}
      >
        {label(cat)}
      </button>
      {open && cat.children && cat.children.length > 0 ? (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {cat.children.map((child) => (
            <CategoryBranch
              key={child.slug}
              cat={child}
              depth={depth + 1}
              categoryFilter={categoryFilter}
              offersOnly={offersOnly}
              label={label}
              navBtn={navBtn}
              onSelectCategory={onSelectCategory}
              t={t}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const ShopSidebar: React.FC<ShopSidebarProps> = ({
  categories,
  brandGroups,
  categoryFilter,
  brandFilter,
  offersOnly,
  onSelectCategory,
  onSelectBrand,
  onToggleOffers,
}) => {
  const { t, language } = useI18n();

  const label = (cat: { nameEn: string; nameAr?: string | null; productCount?: number }) => {
    const name = language === 'ar' && cat.nameAr ? cat.nameAr : cat.nameEn;
    const count = cat.productCount;
    return count != null && count > 0 ? `${name} (${count})` : name;
  };

  const navBtn = (active: boolean) =>
    `w-full rounded-xl px-3 py-2.5 text-start text-sm font-bold transition-colors ${
      active
        ? 'bg-primary text-white shadow-md shadow-primary/20'
        : 'text-muted hover:bg-elevated hover:text-foreground'
    }`;

  return (
    <aside className="space-y-6 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto custom-scrollbar">
      <div>
        <button
          type="button"
          onClick={onToggleOffers}
          className={`w-full rounded-xl border px-3 py-3 text-sm font-black uppercase tracking-wide transition-colors ${
            offersOnly
              ? 'border-[#f37021] bg-[#f37021] text-white'
              : 'border-subtle bg-elevated text-muted hover:text-foreground'
          }`}
        >
          {t('shop.offersSection')}
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-faint">
          {t('shop.categories')}
        </h3>
        <nav className="flex flex-col gap-1">
          <button
            type="button"
            className={navBtn(!categoryFilter && !offersOnly)}
            onClick={() => onSelectCategory(null)}
          >
            {t('shop.allCategories')}
          </button>
          {categories
            .filter((cat) => (cat.productCount ?? 0) > 0)
            .map((cat) => {
            const open = cat.slug === categoryFilter || cat.children?.some((c) => containsSlug(c, categoryFilter || ''));
            return (
              <div key={cat.slug}>
                <button
                  type="button"
                  className={navBtn(categoryFilter === cat.slug && !offersOnly)}
                  onClick={() => onSelectCategory(cat.slug)}
                >
                  {label(cat)}
                </button>
                {open && cat.children && cat.children.length > 0 ? (
                  <div className="ms-2 mt-1 flex flex-col gap-0.5">
                    {cat.children.map((sub) => (
                      <CategoryBranch
                        key={sub.slug}
                        cat={sub}
                        depth={0}
                        categoryFilter={categoryFilter}
                        offersOnly={offersOnly}
                        label={label}
                        navBtn={navBtn}
                        onSelectCategory={onSelectCategory}
                        t={t}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>

      {brandGroups.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-faint">
            {t('shop.brands')}
          </h3>
          <nav className="flex flex-col gap-1 max-h-48 overflow-y-auto custom-scrollbar">
            <button type="button" className={navBtn(!brandFilter)} onClick={() => onSelectBrand(null)}>
              {t('shop.allBrands')}
            </button>
            {brandGroups.map(({ brand }) => (
              <button
                key={brand}
                type="button"
                className={navBtn(brandFilter === brand)}
                onClick={() => onSelectBrand(brand)}
              >
                {brand}
              </button>
            ))}
          </nav>
        </div>
      ) : null}
    </aside>
  );
};
