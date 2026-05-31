import React from 'react';
import { PremiumCard } from '../../components/ui/PremiumCard';
import { premiumVariantForKey } from '../../lib/premiumCardStyles';

interface ShopBrandCardProps {
  brand: string;
  productCount: number;
  brandLabel: string;
  productCountLabel: string;
  selected?: boolean;
  onSelect?: () => void;
}

export const ShopBrandCard: React.FC<ShopBrandCardProps> = ({
  brand,
  productCount,
  brandLabel,
  productCountLabel,
  selected,
  onSelect,
}) => (
  <PremiumCard
    label={brandLabel}
    value={brand}
    sub={productCountLabel}
    icon="storefront"
    variant={premiumVariantForKey(brand)}
    onClick={onSelect}
    className={selected ? 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background' : undefined}
  />
);
