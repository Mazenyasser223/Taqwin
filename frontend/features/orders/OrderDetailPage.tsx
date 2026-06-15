import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { weightedTransition } from '../../lib/motion';
import { formatShopPrice } from '../../lib/shopFormat';
import {
  orderDisplayCurrency,
  orderGrandTotal,
  orderItemsSubtotal,
  orderShippingFee,
} from '../../lib/orderTotals';
import marketplaceService from '../../services/marketplaceService';
import type { Order, OrderStatus, PaymentStatus } from '../../types';
import type { TranslationKey } from '../../lib/i18n/translations';
import { buildOrderTimeline } from './orderStatusTimeline';
import { OrderTimeline } from './OrderTimeline';

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  pending_payment: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
  confirmed: 'bg-primary/10 border-primary/20 text-primary',
  processing: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
  packed: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
  shipped: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  delivered: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/10 border-red-500/20 text-red-400',
};

const STATUS_LABEL_KEY: Record<OrderStatus, TranslationKey> = {
  pending: 'orders.status.pending',
  pending_payment: 'orders.status.pending_payment',
  confirmed: 'orders.status.confirmed',
  processing: 'orders.status.processing',
  packed: 'orders.status.packed',
  shipped: 'orders.status.shipped',
  delivered: 'orders.status.delivered',
  cancelled: 'orders.status.cancelled',
};

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  pending: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  paid: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/10 border-red-500/20 text-red-400',
  refunded: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
};

const PAYMENT_STATUS_LABEL_KEY: Record<PaymentStatus, TranslationKey> = {
  pending: 'orders.payment.pending',
  paid: 'orders.payment.paid',
  failed: 'orders.payment.failed',
  refunded: 'orders.payment.refunded',
};

function normalizeStatus(status: string | undefined): OrderStatus {
  if (status && status in STATUS_STYLES) return status as OrderStatus;
  return 'pending';
}

function normalizePaymentStatus(status: string | undefined): PaymentStatus {
  if (status && status in PAYMENT_STATUS_STYLES) return status as PaymentStatus;
  return 'pending';
}

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useI18n();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const res = await marketplaceService.getOrder(id);
    if (res.error) {
      setError(res.error);
      setOrder(null);
    } else {
      setOrder(res.data ?? null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const timeline = useMemo(() => (order ? buildOrderTimeline(order) : []), [order]);

  const locale = language === 'ar' ? 'ar-EG' : 'en-US';
  const currency = order ? orderDisplayCurrency(order) : 'EGP';

  if (loading) {
    return (
      <div className="page-shell max-w-4xl mx-auto pb-2">
        <div className="glass-panel rounded-2xl p-8 text-center text-primary animate-pulse">
          {t('orders.loading')}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page-shell max-w-4xl mx-auto pb-2 space-y-4">
        {error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        ) : null}
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {t('orders.backToList')}
        </Link>
      </div>
    );
  }

  const status = normalizeStatus(order.status);
  const paymentStatus = normalizePaymentStatus(order.paymentStatus);
  const itemsSubtotal = orderItemsSubtotal(order);
  const shippingFee = orderShippingFee(order);
  const totalLabel = formatShopPrice(orderGrandTotal(order), currency, language);
  const subtotalLabel = formatShopPrice(itemsSubtotal, currency, language);
  const shippingFeeLabel =
    shippingFee <= 0
      ? t('marketplace.shippingFree')
      : formatShopPrice(shippingFee, currency, language);
  const hasShippingAddress = Boolean(
    order.shippingGovernorate || order.shippingCity || order.shippingAddress || order.shippingPhone,
  );

  return (
    <div className="page-shell max-w-4xl mx-auto pb-2 space-y-6">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={weightedTransition}
      >
        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-primary transition mb-4"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {t('orders.backToList')}
        </Link>
        <div className="flex items-center gap-3 text-primary mb-2">
          <span className="material-symbols-outlined font-black">receipt_long</span>
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t('orders.badge')}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          {t('orders.detailTitle')}
        </h1>
        <p className="text-muted mt-2 font-medium font-mono text-sm">#{order.id.slice(0, 8)}</p>
      </motion.div>

      {error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      ) : null}

      <div className="glass-panel rounded-2xl sm:rounded-[2rem] border border-subtle overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-subtle space-y-4">
          <h2 className="text-lg font-black text-foreground">{t('orders.orderSummary')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-faint mb-1">
                {t('orders.paymentStatusLabel')}
              </p>
              <div
                className={`inline-flex px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${PAYMENT_STATUS_STYLES[paymentStatus]}`}
              >
                {t(PAYMENT_STATUS_LABEL_KEY[paymentStatus])}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-faint mb-1">
                {t('orders.shippingStatusLabel')}
              </p>
              <div
                className={`inline-flex px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${STATUS_STYLES[status]}`}
              >
                {t(STATUS_LABEL_KEY[status])}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-faint mb-1">
                {t('orders.carrier')}
              </p>
              <p className="font-bold text-foreground">{order.carrier ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-faint mb-1">
                {t('orders.trackingNumber')}
              </p>
              <p className="font-bold font-mono text-foreground">{order.trackingNumber ?? '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-faint mb-1">
                {t('orders.placedAt')}
              </p>
              <p className="font-bold text-foreground">
                {new Date(order.createdAt).toLocaleString(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-faint mb-1">
                {t('orders.total')}
              </p>
              <p className="text-2xl font-black tabular-nums text-foreground">{totalLabel}</p>
              <div className="mt-2 space-y-0.5 text-xs text-muted">
                <p>
                  {t('marketplace.subtotal')}: {subtotalLabel}
                </p>
                <p>
                  {t('marketplace.shippingFee')}: {shippingFeeLabel}
                </p>
              </div>
            </div>
          </div>
        </div>

        {hasShippingAddress ? (
          <div className="p-6 sm:p-8 border-b border-subtle space-y-3">
            <h2 className="text-lg font-black text-foreground">{t('orders.deliveryAddress')}</h2>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              {order.shippingGovernorate ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-faint mb-1">
                    {t('marketplace.shippingGovernorate')}
                  </p>
                  <p className="font-bold text-foreground">{order.shippingGovernorate}</p>
                </div>
              ) : null}
              {order.shippingCity ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-faint mb-1">
                    {t('marketplace.shippingCity')}
                  </p>
                  <p className="font-bold text-foreground">{order.shippingCity}</p>
                </div>
              ) : null}
              {order.shippingPhone ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-faint mb-1">
                    {t('marketplace.shippingPhone')}
                  </p>
                  <p className="font-bold font-mono text-foreground" dir="ltr">
                    {order.shippingPhone}
                  </p>
                </div>
              ) : null}
              {order.shippingAddress ? (
                <div className="sm:col-span-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-faint mb-1">
                    {t('marketplace.shippingAddress')}
                  </p>
                  <p className="font-medium text-foreground leading-relaxed">{order.shippingAddress}</p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="p-6 sm:p-8 border-b border-subtle">
          <h2 className="text-lg font-black text-foreground mb-4">{t('orders.timeline.title')}</h2>
          <OrderTimeline steps={timeline} variant="customer" />
        </div>

        <div className="p-6 sm:p-8 space-y-3">
          <h2 className="text-lg font-black text-foreground mb-2">{t('orders.itemsTitle')}</h2>
          {(order.items ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
              <span className="font-bold text-foreground">
                {item.product?.name ?? t('orders.item')} × {item.quantity}
              </span>
              <span className="text-muted shrink-0 tabular-nums">
                {formatShopPrice(
                  (Number(item.unitPrice) || 0) * item.quantity,
                  item.product?.currency ?? currency,
                  language,
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
