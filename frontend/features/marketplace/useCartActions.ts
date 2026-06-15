import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { decodeShopHtml, plainTextFromHtml } from '../../lib/shopDescription';
import { useCartStore } from '../../store/useCartStore';
import type { Product } from '../../types';
import type { OrderSource } from '../../lib/orderAttribution';
import { setShopAttribution } from '../../lib/orderAttribution';
import { trackShopFunnel } from '../../lib/shopFunnel';

export interface CartToastState {
  productName: string;
}

export interface AddToCartOptions {
  source?: OrderSource;
}

const TOAST_MS = 2600;

export function useCartActions() {
  const cart = useCartStore();
  const { language } = useI18n();
  const [toast, setToast] = useState<CartToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  const addToCart = useCallback(
    (product: Product, qty = 1, opts?: AddToCartOptions) => {
      if (opts?.source) setShopAttribution(opts.source);
      cart.add(product, qty);
      void trackShopFunnel('add_to_cart', { productId: product.id });
      const raw = language === 'ar' && product.nameAr ? product.nameAr : product.name;
      const productName = plainTextFromHtml(decodeShopHtml(raw)).slice(0, 72);
      setToast({ productName });
    },
    [cart, language]
  );

  const addBundleToCart = useCallback(
    (products: Product[], opts?: AddToCartOptions) => {
      if (opts?.source) setShopAttribution(opts.source);
      for (const product of products) {
        if (product.stock > 0) cart.add(product, 1);
      }
      const count = products.length;
      const bundleName =
        language === 'ar'
          ? `${count} منتجات من الباقة المقترحة`
          : `${count} items from your recommended bundle`;
      setToast({ productName: bundleName });
    },
    [cart, language]
  );

  return {
    addToCart,
    addBundleToCart,
    toast,
    dismissToast: () => setToast(null),
  };
}
