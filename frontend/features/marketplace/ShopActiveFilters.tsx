import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';

interface ShopActiveFiltersProps {
  categoryLabel?: string | null;
  brandFilter: string | null;
  offersOnly: boolean;
  searchQuery?: string;
  onClear: () => void;
  onClearCategory: () => void;
  onClearBrand: () => void;
  onClearOffers: () => void;
  onClearSearch: () => void;
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-muted transition hover:bg-primary/15 hover:text-foreground"
        aria-label="Remove filter"
      >
        <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    </span>
  );
}

export const ShopActiveFilters: React.FC<ShopActiveFiltersProps> = ({
  categoryLabel,
  brandFilter,
  offersOnly,
  searchQuery,
  onClear,
  onClearCategory,
  onClearBrand,
  onClearOffers,
  onClearSearch,
}) => {
  const { t } = useI18n();
  const hasAny = Boolean(categoryLabel || brandFilter || offersOnly || searchQuery?.trim());

  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-subtle bg-elevated/50 px-3 py-2.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-faint">{t('shop.activeFilters')}</span>
      {searchQuery?.trim() ? (
        <ActiveChip
          label={t('shop.searchChip', { query: searchQuery.trim() })}
          onRemove={onClearSearch}
        />
      ) : null}
      {offersOnly ? <ActiveChip label={t('shop.offersOnly')} onRemove={onClearOffers} /> : null}
      {categoryLabel ? <ActiveChip label={categoryLabel} onRemove={onClearCategory} /> : null}
      {brandFilter ? <ActiveChip label={brandFilter} onRemove={onClearBrand} /> : null}
      <button
        type="button"
        onClick={onClear}
        className="ms-auto text-xs font-bold text-primary hover:underline"
      >
        {t('shop.clearFilters')}
      </button>
    </div>
  );
};
