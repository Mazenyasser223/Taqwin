import React from 'react';
import { PremiumCard } from '../../components/ui/PremiumCard';
import { premiumVariantForKey } from '../../lib/premiumCardStyles';
import type { ShopCategory } from '../../types';

interface ShopCategoryCardProps {
  category: ShopCategory;
  label: string;
  selected?: boolean;
  onSelect?: () => void;
}

export const ShopCategoryCard: React.FC<ShopCategoryCardProps> = ({
  category,
  label,
  selected,
  onSelect,
}) => (
  <PremiumCard
    label={label}
    value={category.nameEn}
    sub={category.children?.length ? `${category.children.length}` : undefined}
    icon={category.icon || 'category'}
    variant={premiumVariantForKey(category.slug)}
    onClick={onSelect}
    className={selected ? 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background' : undefined}
  />
);
