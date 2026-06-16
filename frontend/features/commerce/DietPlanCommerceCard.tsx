import React, { useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { formatShopPrice } from '../../lib/shopFormat';
import { decodeShopHtml, plainTextFromHtml } from '../../lib/shopDescription';
import { useCartActions } from '../marketplace/useCartActions';
import { CartToast } from '../marketplace/CartToast';
import aiCommerceService, { type DietPlanCommerce } from '../../services/aiCommerceService';
import type { Product } from '../../types';

function productLabel(product: Product, language: string): string {
  const raw = language === 'ar' && product.nameAr ? product.nameAr : product.name;
  return plainTextFromHtml(decodeShopHtml(raw)).slice(0, 80);
}

export function DietPlanCommerceCard({
  dietProducts,
  loading,
}: {
  dietProducts: DietPlanCommerce | null;
  loading?: boolean;
}) {
  const { t, language } = useI18n();
  const { addToCart, addBundleToCart, toast, dismissToast } = useCartActions();
  const [adding, setAdding] = useState(false);

  if (loading) {
    return (
      <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
        <p className="text-sm text-gray-500">{t('commerce.loading')}</p>
      </div>
    );
  }

  const rows = dietProducts?.products ?? [];
  if (!rows.length) return null;

  const handleAddAll = () => {
    setAdding(true);
    try {
      addBundleToCart(rows.map((r) => r.product));
      void aiCommerceService.trackEvent({
        eventType: 'bundle_added',
        source: 'diet_plan',
        productIds: rows.map((r) => r.product.id),
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <>
      <div className="mt-4 rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/8 to-transparent p-4 dark:border-emerald-500/20">
        <div className="mb-3 flex items-start gap-2">
          <span className="material-symbols-outlined shrink-0 text-emerald-600">restaurant</span>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white/90">{t('commerce.dietPlanTitle')}</p>
            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{t('commerce.dietPlanSubtitle')}</p>
          </div>
        </div>
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.product.id}
              className="flex items-start gap-3 rounded-lg border border-gray-200/80 bg-white/80 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/60"
            >
              {row.product.imageUrl ? (
                <img src={row.product.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white/90">
                  {productLabel(row.product, language)}
                </p>
                <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                  {row.reason || t('commerce.reason.dietPlan')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  addToCart(row.product);
                  void aiCommerceService.trackEvent({
                    eventType: 'clicked',
                    source: 'diet_plan',
                    productId: row.product.id,
                  });
                }}
                className="shrink-0 text-[10px] font-medium text-brand-600 hover:underline"
              >
                {t('shop.addToCart')}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t border-gray-200/80 pt-3 dark:border-gray-700">
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {formatShopPrice(dietProducts?.subtotal ?? 0, dietProducts?.currency, language)}
          </span>
          <button
            type="button"
            disabled={adding}
            onClick={handleAddAll}
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {adding ? t('commerce.addingBundle') : t('commerce.addAllToCart')}
          </button>
        </div>
      </div>
      <CartToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
