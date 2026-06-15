import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { formatShopPrice } from '../../lib/shopFormat';
import { plainTextFromHtml, decodeShopHtml } from '../../lib/shopDescription';
import marketplaceOptimizationService, {
  type ReorderSuggestion,
} from '../../services/marketplaceOptimizationService';
import { useCartActions } from '../marketplace/useCartActions';
import { productPagePath } from '../marketplace/productPagePath';

export function ReorderBanner({ className = '' }: { className?: string }) {
  const { t, language } = useI18n();
  const { addToCart } = useCartActions();
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void marketplaceOptimizationService.getReorderSuggestions().then((res) => {
      if (res.data?.suggestions?.length) setSuggestions(res.data.suggestions.slice(0, 3));
    });
  }, []);

  if (dismissed || !suggestions.length) return null;

  const top = suggestions[0];
  const product = top.product;
  const name =
    language === 'ar' && product.nameAr
      ? plainTextFromHtml(decodeShopHtml(product.nameAr))
      : plainTextFromHtml(decodeShopHtml(product.name));
  const path = productPagePath(product);

  return (
    <div
      className={`relative rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent p-4 ${className}`}
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute end-2 top-2 rounded p-1 text-gray-400 hover:text-gray-600"
        aria-label={t('commerce.dismiss')}
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
      <div className="flex flex-wrap items-center gap-3 pe-6">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
            <span className="material-symbols-outlined text-gray-400">inventory_2</span>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white/90">
            {t('shop.reorderTitle', { product: name })}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {t('shop.reorderSubtitle', { days: String(top.daysSincePurchase) })} ·{' '}
            {formatShopPrice(product.price, product.currency, language)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {path ? (
            <Link
              to={path}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium dark:border-gray-600"
            >
              {t('shop.viewProduct')}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => addToCart(product, top.suggestedQuantity, { source: 'direct' })}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white"
          >
            {t('shop.reorderNow')}
          </button>
        </div>
      </div>
    </div>
  );
}
