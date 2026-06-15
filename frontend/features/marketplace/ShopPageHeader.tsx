import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';

interface ShopPageHeaderProps {
  cartCount: number;
}

export const ShopPageHeader: React.FC<ShopPageHeaderProps> = ({ cartCount }) => {
  const { t } = useI18n();

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
            <span className="material-symbols-outlined text-2xl text-primary">storefront</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">{t('shop.title')}</h1>
            <p className="mt-0.5 text-sm text-muted">{t('shop.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
        <Link
          to="/marketplace/cart"
          className="col-span-2 inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-black text-white shadow-md shadow-primary/25 transition hover:bg-primary/90 sm:col-span-1 sm:px-4"
        >
          <span className="material-symbols-outlined shrink-0 text-[20px]">shopping_bag</span>
          <span className="truncate">{t('marketplace.cart', { count: String(cartCount) })}</span>
        </Link>
        <Link
          to="/orders"
          className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border border-subtle bg-elevated px-3 py-2.5 text-sm font-bold text-foreground transition hover:bg-elevated-hover sm:px-4"
        >
          <span className="material-symbols-outlined shrink-0 text-[20px] text-muted">receipt_long</span>
          <span className="truncate">{t('marketplace.viewOrders')}</span>
        </Link>
        <Link
          to="/marketplace/wishlist"
          className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border border-subtle bg-elevated px-3 py-2.5 text-sm font-bold text-foreground transition hover:bg-elevated-hover sm:px-4"
        >
          <span className="material-symbols-outlined shrink-0 text-[20px] text-red-400">favorite</span>
          <span className="truncate">{t('shop.wishlistTitle')}</span>
        </Link>
      </div>
    </header>
  );
};
