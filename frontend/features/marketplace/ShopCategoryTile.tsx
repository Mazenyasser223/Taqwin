import React from 'react';
import { PremiumCardShell } from '../../lib/premiumCardShell';
import { SHOP_DEFAULT_VARIANT } from '../../lib/premiumCardStyles';
import type { ShopCategory } from '../../types';

interface ShopCategoryTileProps {
  category: ShopCategory;
  name: string;
  selected?: boolean;
  onSelect?: () => void;
}

/** MFB-style large category tile with Taqwin premium styling. */
export const ShopCategoryTile: React.FC<ShopCategoryTileProps> = ({
  category,
  name,
  selected,
  onSelect,
}) => {
  return (
    <PremiumCardShell
      variant={SHOP_DEFAULT_VARIANT}
      onClick={onSelect}
      selected={selected}
      className="flex min-h-[120px] w-[140px] shrink-0 flex-col items-center justify-center gap-2 p-4 sm:min-h-[140px] sm:w-[160px]"
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-white/20 to-white/5 ring-1 ring-white/15"
        style={{ boxShadow: `0 8px 20px -6px rgba(0,0,0,0.25)` }}
      >
        <span className="material-symbols-outlined text-3xl text-primary">
          {category.icon || 'category'}
        </span>
      </div>
      <p className="text-center text-xs font-black uppercase leading-tight tracking-wide text-foreground sm:text-sm">
        {name}
      </p>
      {(category.productCount ?? 0) > 0 ? (
        <span className="text-[10px] font-semibold text-muted">{category.productCount}</span>
      ) : null}
    </PremiumCardShell>
  );
};
