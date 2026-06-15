import React, { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import marketplaceOptimizationService, {
  type ProductSubscription,
} from '../../services/marketplaceOptimizationService';
import type { Product } from '../../types';

interface SubscribePanelProps {
  product: Product;
}

export function SubscribePanel({ product }: SubscribePanelProps) {
  const { t } = useI18n();
  const [intervalDays, setIntervalDays] = useState(30);
  const [quantity, setQuantity] = useState(1);
  const [existing, setExisting] = useState<ProductSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void marketplaceOptimizationService.getSubscriptions().then((res) => {
      const match = res.data?.items.find((s) => s.productId === product.id && s.status !== 'cancelled');
      if (match) setExisting(match);
    });
  }, [product.id]);

  const subscribe = async () => {
    setLoading(true);
    setMessage(null);
    const res = await marketplaceOptimizationService.createSubscription({
      productId: product.id,
      quantity,
      intervalDays,
    });
    setLoading(false);
    if (res.error) {
      setMessage(res.error);
      return;
    }
    if (res.data) {
      setExisting(res.data);
      setMessage(t('shop.subscriptionCreated'));
    }
  };

  const cancel = async () => {
    if (!existing) return;
    setLoading(true);
    await marketplaceOptimizationService.cancelSubscription(existing.id);
    setExisting(null);
    setLoading(false);
    setMessage(t('shop.subscriptionCancelled'));
  };

  if (product.stock <= 0) return null;

  return (
    <div className="rounded-xl border border-brand-500/25 bg-brand-500/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="material-symbols-outlined text-brand-600">autorenew</span>
        <h3 className="text-sm font-bold text-foreground">{t('shop.subscribeTitle')}</h3>
      </div>
      <p className="mb-3 text-xs text-muted">{t('shop.subscribeSubtitle')}</p>

      {existing ? (
        <div className="space-y-2 text-sm">
          <p className="text-emerald-600 dark:text-emerald-400">
            {t('shop.subscriptionActive', {
              days: String(existing.intervalDays),
              date: new Date(existing.nextDeliveryAt).toLocaleDateString(),
            })}
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void cancel()}
            className="text-xs font-semibold text-red-500 hover:underline"
          >
            {t('shop.cancelSubscription')}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-muted">{t('shop.subscriptionInterval')}</span>
            <select
              value={intervalDays}
              onChange={(e) => setIntervalDays(Number(e.target.value))}
              className="rounded-lg border border-subtle bg-transparent px-2 py-1.5 text-sm"
            >
              <option value={14}>14 {t('shop.days')}</option>
              <option value={30}>30 {t('shop.days')}</option>
              <option value={60}>60 {t('shop.days')}</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-semibold text-muted">{t('shop.quantity')}</span>
            <input
              type="number"
              min={1}
              max={10}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              className="w-16 rounded-lg border border-subtle bg-transparent px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void subscribe()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {loading ? t('shop.subscribing') : t('shop.subscribeNow')}
          </button>
        </div>
      )}
      {message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}
    </div>
  );
}
