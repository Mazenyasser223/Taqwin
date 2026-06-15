import marketplaceService from '../../services/marketplaceService';
import type { CartItem } from '../../store/useCartStore';
import type { Product } from '../../types';

export interface CartPriceChange {
  productId: string;
  name: string;
  oldPrice: number;
  newPrice: number;
}

export interface RefreshCartResult {
  items: CartItem[];
  removedCount: number;
  priceChanges: CartPriceChange[];
}

export async function refreshCartItems(items: CartItem[]): Promise<RefreshCartResult> {
  const results = await Promise.all(
    items.map((item) => marketplaceService.getProduct(item.product.id))
  );

  const nextItems: CartItem[] = [];
  let removedCount = 0;
  const priceChanges: CartPriceChange[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const res = results[i];
    const product = res.data as Product | undefined;

    if (res.error || !product?.isActive || (product.stock != null && product.stock <= 0)) {
      removedCount += 1;
      continue;
    }

    let quantity = item.quantity;
    if (product.stock != null && quantity > product.stock) {
      quantity = product.stock;
    }

    const baseline = item.addedPrice ?? item.product.price;
    if (product.price !== baseline) {
      priceChanges.push({
        productId: product.id,
        name: product.name,
        oldPrice: baseline,
        newPrice: product.price,
      });
    }

    nextItems.push({
      product,
      quantity,
      addedPrice: item.addedPrice ?? item.product.price,
    });
  }

  return { items: nextItems, removedCount, priceChanges };
}

export function acknowledgePriceChanges(items: CartItem[]): CartItem[] {
  return items.map((item) => ({
    ...item,
    addedPrice: item.product.price,
  }));
}
