/** Shared palette for kpi-card-premium–style surfaces (dashboard + shop). */

export type PremiumCardVariant = 'teal' | 'orange' | 'violet';

export const PREMIUM_CARD_STYLES: Record<
  PremiumCardVariant,
  { accent: string; glow: string; border: string; wash: string; iconFrom: string; iconTo: string }
> = {
  teal: {
    accent: '#158b8d',
    glow: 'rgba(21, 139, 141, 0.35)',
    border: 'border-[#158b8d]/25 dark:border-[#158b8d]/35',
    wash: 'from-[#158b8d]/18 via-[#158b8d]/5 to-transparent',
    iconFrom: 'from-[#158b8d]/45',
    iconTo: 'to-[#158b8d]/10',
  },
  orange: {
    accent: '#f37021',
    glow: 'rgba(243, 112, 33, 0.38)',
    border: 'border-[#f37021]/25 dark:border-[#f37021]/35',
    wash: 'from-[#f37021]/20 via-[#f37021]/6 to-transparent',
    iconFrom: 'from-[#f37021]/50',
    iconTo: 'to-[#f37021]/10',
  },
  violet: {
    accent: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.38)',
    border: 'border-[#6366f1]/25 dark:border-[#6366f1]/35',
    wash: 'from-[#6366f1]/22 via-[#6366f1]/6 to-transparent',
    iconFrom: 'from-[#6366f1]/50',
    iconTo: 'to-[#6366f1]/10',
  },
};

const VARIANTS: PremiumCardVariant[] = ['teal', 'orange', 'violet'];

export function premiumVariantForKey(key: string): PremiumCardVariant {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i) * (i + 1)) % 997;
  return VARIANTS[hash % VARIANTS.length];
}

/** Shop: orange glow for discounted products; single teal glow for the rest. */
export function shopProductCardVariant(product: {
  isOnSale?: boolean;
  price: number;
  compareAtPrice?: number | null;
  discountPercent?: number | null;
}): PremiumCardVariant {
  const hasDiscount =
    Boolean(product.isOnSale) ||
    Boolean(product.discountPercent && product.discountPercent > 0) ||
    Boolean(product.compareAtPrice && product.compareAtPrice > product.price);
  return hasDiscount ? 'orange' : 'teal';
}

/** Non-sale shop surfaces (category tiles, etc.) — one consistent glow. */
export const SHOP_DEFAULT_VARIANT: PremiumCardVariant = 'teal';
