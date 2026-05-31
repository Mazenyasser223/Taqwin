import type { Product } from '../types';

export function formatShopPrice(amount: number, currency = 'EGP', locale?: string): string {
  const loc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toFixed(0)} ${currency}`;
  }
}

export function productDisplayPrice(product: Product, locale?: string): string {
  if (product.hasVariants && product.priceMin != null) {
    const min = formatShopPrice(product.priceMin, product.currency, locale);
    const max =
      product.priceMax != null
        ? formatShopPrice(product.priceMax, product.currency, locale)
        : null;
    return max && product.priceMax !== product.priceMin ? `${min} – ${max}` : `from ${min}`;
  }
  return formatShopPrice(product.price, product.currency, locale);
}

export function productComparePrice(product: Product, locale?: string): string | null {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price) return null;
  return formatShopPrice(product.compareAtPrice, product.currency, locale);
}
