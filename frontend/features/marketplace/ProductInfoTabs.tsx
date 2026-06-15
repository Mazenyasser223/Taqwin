import React, { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { DescriptionSection } from '../../lib/shopDescription';
import { extractNutritionHtml, isSupplementProduct } from './productNutrition';
import type { Product } from '../../types';

type TabId = 'nutrition' | 'shipping' | 'reviews';

interface ProductInfoTabsProps {
  product: Product;
  descSections: DescriptionSection[];
}

export const ProductInfoTabs: React.FC<ProductInfoTabsProps> = ({
  product,
  descSections,
}) => {
  const { t } = useI18n();
  const supplement = isSupplementProduct(product);
  const nutritionHtml = useMemo(() => extractNutritionHtml(descSections), [descSections]);

  const tabs = useMemo(() => {
    const list: { id: TabId; label: string }[] = [];
    if (supplement) {
      list.push({ id: 'nutrition', label: t('shop.productTabNutrition') });
    }
    list.push({ id: 'shipping', label: t('shop.productTabShipping') });
    list.push({ id: 'reviews', label: t('shop.productTabReviews') });
    return list;
  }, [supplement, t]);

  const [active, setActive] = useState<TabId>(tabs[0]?.id ?? 'shipping');

  useEffect(() => {
    setActive(tabs[0]?.id ?? 'shipping');
  }, [product.id, tabs]);

  return (
    <div className="shop-product-section-card overflow-hidden rounded-2xl border border-primary/25 shadow-[0_8px_32px_-8px_rgba(21,139,141,0.2)]">
      <div
        className="flex gap-1 overflow-x-auto border-b border-subtle/50 px-2 py-2 no-scrollbar"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition sm:text-sm ${
              active === tab.id
                ? 'bg-primary/20 text-primary'
                : 'text-muted hover:bg-elevated hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-5 py-5">
        {active === 'nutrition' && supplement ? (
          nutritionHtml ? (
            <div
              className="shop-product-prose text-sm leading-relaxed text-muted [&_table]:w-full [&_td]:border [&_td]:border-subtle [&_td]:p-2 [&_th]:border [&_th]:border-subtle [&_th]:p-2"
              dangerouslySetInnerHTML={{ __html: nutritionHtml }}
            />
          ) : (
            <p className="text-sm text-muted">{t('shop.nutritionUnavailable')}</p>
          )
        ) : null}

        {active === 'shipping' ? (
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex gap-2">
              <span className="material-symbols-outlined shrink-0 text-primary text-lg">local_shipping</span>
              <span>{t('shop.shippingDelivery')}</span>
            </li>
            <li className="flex gap-2">
              <span className="material-symbols-outlined shrink-0 text-primary text-lg">pin_drop</span>
              <span>{t('shop.shippingTracking')}</span>
            </li>
            <li className="flex gap-2">
              <span className="material-symbols-outlined shrink-0 text-primary text-lg">lock</span>
              <span>{t('shop.shippingPayment')}</span>
            </li>
          </ul>
        ) : null}

        {active === 'reviews' ? (
          <div className="rounded-xl border border-dashed border-subtle bg-elevated/30 px-6 py-10 text-center">
            <span className="material-symbols-outlined mb-2 text-4xl text-muted">rate_review</span>
            <p className="text-sm font-semibold text-foreground">{t('shop.reviewsComingSoon')}</p>
            <p className="mt-1 text-xs text-muted">{t('shop.reviewsComingSoonHint')}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};
