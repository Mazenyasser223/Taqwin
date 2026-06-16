import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import marketplaceOptimizationService, { type WishlistItem } from '../../services/marketplaceOptimizationService';
import { ShopProductCard } from '../marketplace/ShopProductCard';
import { useCartActions } from '../marketplace/useCartActions';
import { CartToast } from '../marketplace/CartToast';
import { productPagePath } from '../marketplace/productPagePath';
import { SHOP_SHELL, SHOP_PRODUCT_GRID } from '../marketplace/shopLayout';

export function WishlistPage() {
  const { t } = useI18n();
  const { addToCart, toast, dismissToast } = useCartActions();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    void marketplaceOptimizationService.getWishlist().then((res) => {
      setLoading(false);
      if (res.data) setItems(res.data.items);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  const handleRemove = async (productId: string) => {
    await marketplaceOptimizationService.removeFromWishlist(productId);
    reload();
  };

  return (
    <div className={`${SHOP_SHELL} space-y-4 pb-10 sm:space-y-6`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-foreground">{t('shop.wishlistTitle')}</h1>
        <Link to="/marketplace" className="text-sm font-bold text-primary hover:underline">
          {t('shop.backToShop')}
        </Link>
      </header>

      {loading ? (
        <p className="text-muted">{t('shop.loading')}</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-subtle p-8 text-center text-muted">
          {t('shop.wishlistEmpty')}
        </p>
      ) : (
        <div className={SHOP_PRODUCT_GRID}>
          {items.map((item) => (
            <div key={item.id} className="relative">
              <ShopProductCard
                product={item.product}
                productTo={productPagePath(item.product) ?? undefined}
                onAdd={() => addToCart(item.product, 1, { source: 'direct' })}
                inStockLabel={t('marketplace.inStock')}
                outOfStockLabel={t('shop.outOfStock')}
                addLabel={t('shop.addToCart')}
              />
              <button
                type="button"
                onClick={() => void handleRemove(item.productId)}
                className="absolute end-3 top-3 z-20 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                aria-label={t('shop.removeFromWishlist')}
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <CartToast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}

export default WishlistPage;
