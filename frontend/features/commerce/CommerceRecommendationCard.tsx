import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../lib/i18n/useI18n';
import { formatShopPrice } from '../../lib/shopFormat';
import { decodeShopHtml, plainTextFromHtml } from '../../lib/shopDescription';
import { useCartActions } from '../marketplace/useCartActions';
import { CartToast } from '../marketplace/CartToast';
import aiCommerceService, {
  type CommerceBundle,
  type CommerceRecommendedRow,
  type CommerceEventType,
} from '../../services/aiCommerceService';
import { ProductRating } from './ProductRating';
import {
  dismissCommerceBundle,
  isBundleDismissed,
  savePendingCommerceBundle,
} from '../../lib/commerceSessionStorage';
import type { Product } from '../../types';

function productLabel(product: Product, language: string): string {
  const raw = language === 'ar' && product.nameAr ? product.nameAr : product.name;
  return plainTextFromHtml(decodeShopHtml(raw)).slice(0, 80);
}

function rowReason(row: CommerceRecommendedRow, language: string): string | null {
  if (language === 'ar' && row.reasonAr) return row.reasonAr;
  if (language === 'en' && row.reasonEn) return row.reasonEn;
  return row.reason ?? null;
}

function rowToProduct(row: CommerceRecommendedRow): Product {
  return row.product;
}

export interface CommerceRecommendationCardProps {
  bundle: CommerceBundle | null;
  loading?: boolean;
  compact?: boolean;
  source?: string;
  className?: string;
  onDismiss?: () => void;
  /** Match Taqwin shop theme tokens instead of neutral gray. */
  surface?: 'default' | 'shop';
}

export function CommerceRecommendationCard({
  bundle,
  loading = false,
  compact = false,
  source = 'dashboard_diet',
  className = '',
  onDismiss,
  surface = 'default',
}: CommerceRecommendationCardProps) {
  const { t, language } = useI18n();
  const shop = surface === 'shop';
  const { addToCart, addBundleToCart, toast, dismissToast } = useCartActions();
  const [adding, setAdding] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    if (bundle?.sessionId && isBundleDismissed(bundle.sessionId)) {
      setHidden(true);
    }
  }, [bundle?.sessionId]);

  const rows = bundle?.products ?? [];
  const fbt = bundle?.frequentlyBoughtTogether ?? [];
  const hasProducts = rows.length > 0;

  const subtotalLabel = useMemo(() => {
    if (!bundle || !hasProducts) return null;
    return formatShopPrice(bundle.subtotal, bundle.currency, language);
  }, [bundle, hasProducts, language]);

  const totalLabel = useMemo(() => {
    if (!bundle || !hasProducts) return null;
    return formatShopPrice(bundle.total ?? bundle.subtotal, bundle.currency, language);
  }, [bundle, hasProducts, language]);

  if (loading) {
    return (
      <div
        className={`rounded-xl border p-4 ${shop ? 'border-subtle bg-elevated/50' : 'border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-white/[0.02]'} ${className}`}
      >
        <p className={`text-sm ${shop ? 'text-muted' : 'text-gray-500 dark:text-gray-400'}`}>{t('commerce.loading')}</p>
      </div>
    );
  }

  if (!hasProducts || hidden) return null;

  const track = (eventType: CommerceEventType, productId?: string) => {
    void aiCommerceService.trackEvent({
      eventType,
      source,
      sessionId: bundle?.sessionId,
      bundleId: bundle?.bundleId,
      productId,
      productIds: rows.map((r) => r.product.id),
      metadata: {
        experimentId: bundle?.abTest?.experimentId ?? null,
        abVariant: bundle?.abTest?.variantKey ?? null,
        variantKey: bundle?.abTest?.variantKey ?? null,
      },
    });
  };

  const handleAddSingle = (row: CommerceRecommendedRow) => {
    track('clicked', row.product.id);
    addToCart(row.product, 1, { source: 'ai_recommendation' });
  };

  const handleAddBundle = async () => {
    setAdding(true);
    try {
      track('bundle_added');
      addBundleToCart(rows.map(rowToProduct), { source: 'ai_bundle' });
      if (bundle) {
        savePendingCommerceBundle({
          sessionId: bundle.sessionId,
          bundleId: bundle.bundleId,
          productIds: rows.map((r) => r.product.id),
          discountPercent: bundle.discountPercent ?? 0,
          source: 'ai_bundle',
          abVariant: bundle.abTest?.variantKey,
          experimentId: bundle.abTest?.experimentId,
        });
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDismiss = () => {
    if (bundle?.sessionId) {
      dismissCommerceBundle(bundle.sessionId);
      track('dismissed');
    }
    setHidden(true);
    onDismiss?.();
  };

  const renderRow = (row: CommerceRecommendedRow, key?: string) => {
    const product = row.product;
    const reason = rowReason(row, language);
    return (
      <li
        key={key ?? product.id}
        className="flex items-start gap-3 rounded-lg border border-gray-200/80 bg-white/80 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/60"
      >
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" className="mt-0.5 h-10 w-10 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800">
            <span className="material-symbols-outlined text-gray-400">inventory_2</span>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white/90">{productLabel(product, language)}</p>
          <ProductRating avgRating={product.avgRating} reviewCount={product.reviewCount} className="mt-0.5" />
          {reason ? (
            <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{reason}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
            {formatShopPrice(product.price, product.currency, language)}
          </span>
          <button
            type="button"
            onClick={() => handleAddSingle(row)}
            className="text-[10px] font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {t('shop.addToCart')}
          </button>
        </div>
      </li>
    );
  };

  return (
    <>
      <div
        className={`relative min-w-0 overflow-hidden rounded-xl border p-4 ${compact ? 'mt-2' : 'mt-4'} ${className} ${
          shop
            ? 'border-primary/25 bg-gradient-to-br from-primary/8 to-transparent'
            : 'border-brand-500/25 bg-gradient-to-br from-brand-500/8 to-transparent dark:border-brand-500/20 dark:from-brand-500/10'
        }`}
      >
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute end-2 top-2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          aria-label={t('commerce.dismiss')}
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        <div className="mb-3 flex items-start gap-2 pe-6">
          <span className="material-symbols-outlined shrink-0 text-brand-600 dark:text-brand-400">shopping_bag</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white/90">
              {bundle?.bundleTitle || t('commerce.coachTitle')}
            </p>
            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
              {t('commerce.coachSubtitle')}
              {bundle?.abTest?.variantKey ? (
                <span className="ms-1 rounded bg-brand-500/15 px-1.5 py-0.5 font-semibold text-brand-700 dark:text-brand-300">
                  {bundle.abTest.variantKey}: {bundle.abTest.variantName}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <ul className="space-y-2">{rows.map((row) => renderRow(row))}</ul>

        {fbt.length > 0 ? (
          <div className="mt-4 border-t border-gray-200/80 pt-3 dark:border-gray-700">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('commerce.peopleAlsoBuy')}
            </p>
            <ul className="space-y-2">{fbt.map((row) => renderRow(row, `fbt-${row.product.id}`))}</ul>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200/80 pt-3 dark:border-gray-700">
          <span className="text-xs text-gray-600 dark:text-gray-400">{t('commerce.feedbackPrompt')}</span>
          {feedbackSent ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">{t('commerce.feedbackThanks')}</span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  track('feedback_positive');
                  setFeedbackSent(true);
                }}
                className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                aria-label={t('commerce.feedbackPrompt')}
              >
                👍
              </button>
              <button
                type="button"
                onClick={() => {
                  track('feedback_negative');
                  setFeedbackSent(true);
                }}
                className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                👎
              </button>
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200/80 pt-3 dark:border-gray-700">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {subtotalLabel ? (
              <p>
                {t('commerce.bundleSubtotal')}:{' '}
                <span className="font-semibold text-gray-900 dark:text-white/90">{subtotalLabel}</span>
              </p>
            ) : null}
            {bundle && bundle.discountPercent > 0 ? (
              <p className="mt-0.5 text-emerald-600 dark:text-emerald-400">
                {t('commerce.savePercent', { percent: String(bundle.discountPercent) })} ·{' '}
                <span className="font-semibold">{totalLabel}</span>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/marketplace/cart"
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t('commerce.viewCart')}
            </Link>
            <button
              type="button"
              disabled={adding}
              onClick={() => void handleAddBundle()}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
            >
              {adding ? t('commerce.addingBundle') : t('commerce.addRecommendedBundle')}
            </button>
          </div>
        </div>
      </div>
      <CartToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}

export function commerceBundleFromToolOutput(
  output: Record<string, unknown> | undefined,
): CommerceBundle | null {
  if (!output || typeof output !== 'object') return null;
  const direct = output.bundle as CommerceBundle | undefined;
  if (direct?.products?.length) return direct;
  const products = output.products as Array<Record<string, unknown>> | undefined;
  if (!products?.length) return null;
  const rows: CommerceRecommendedRow[] = [];
  for (const p of products) {
    const { slot, reasonKey, reason, reasonEn, reasonAr, reasonParams, ...productFields } = p;
    if (!productFields.id) continue;
    rows.push({
      slot: String(slot || ''),
      reasonKey: String(reasonKey || ''),
      reason: reason ? String(reason) : undefined,
      reasonEn: reasonEn ? String(reasonEn) : undefined,
      reasonAr: reasonAr ? String(reasonAr) : undefined,
      reasonParams: (reasonParams as Record<string, string | null>) || {},
      product: productFields as Product,
    });
  }
  if (!rows.length) return null;
  return {
    sessionId: String(output.sessionId || ''),
    bundleId: String(output.bundleId || 'coach-bundle'),
    bundleTitle: String(output.bundleTitle || ''),
    locale: 'ar',
    basedOn: {
      goal: null,
      weightKg: null,
      gender: null,
      fitnessLevel: null,
      proteinTargetG: null,
    },
    products: rows,
    subtotal: Number(output.subtotal) || rows.reduce((s, r) => s + r.product.price, 0),
    discountPercent: Number(output.discountPercent) || 0,
    discountAmount: Number(output.discountAmount) || 0,
    total: Number(output.total) || Number(output.subtotal) || 0,
    currency: String(output.currency || 'EGP'),
    empty: false,
  };
}
