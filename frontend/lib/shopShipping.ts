/** Keep in sync with backend-node/src/lib/shopShipping.js */
export const SHOP_FREE_SHIPPING_MIN_EGP = 1500;
export const SHOP_FLAT_SHIPPING_FEE_EGP = 75;

export interface ShippingRules {
  freeShippingMin: number;
  flatFee: number;
  currency: string;
}

export function computeShippingFee(subtotal: number, rules?: Pick<ShippingRules, 'freeShippingMin' | 'flatFee'>) {
  const min = rules?.freeShippingMin ?? SHOP_FREE_SHIPPING_MIN_EGP;
  const flat = rules?.flatFee ?? SHOP_FLAT_SHIPPING_FEE_EGP;
  const safe = Math.max(0, subtotal);
  return safe >= min ? 0 : flat;
}

export function computeOrderTotals(subtotal: number, rules?: Pick<ShippingRules, 'freeShippingMin' | 'flatFee'>) {
  const shippingFee = computeShippingFee(subtotal, rules);
  return {
    subtotal: Math.max(0, subtotal),
    shippingFee,
    total: Math.max(0, subtotal) + shippingFee,
  };
}
