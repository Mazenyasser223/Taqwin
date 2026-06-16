import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { formatShopPrice } from '../../lib/shopFormat';
import marketplaceService from '../../services/marketplaceService';
import type { Order } from '../../types';
import { weightedTransition } from '../../lib/motion';

export const CheckoutSuccessPage: React.FC = () => {
  const [params] = useSearchParams();
  const orderId = params.get('order');
  const refunded = params.get('refunded') === '1';
  const { t, language } = useI18n();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!orderId) return;

    const sessionId = params.get('session_id');
    if (sessionId) {
      void marketplaceService.syncStripePayment(orderId, sessionId).then((res) => {
        if (res.data) setOrder(res.data);
        else {
          void marketplaceService.getOrder(orderId).then((r) => {
            if (r.data) setOrder(r.data);
          });
        }
      });
      return;
    }

    void marketplaceService.getOrder(orderId).then((res) => {
      if (res.data) setOrder(res.data);
    });
  }, [orderId, params]);

  const shortId = orderId?.slice(0, 8).toUpperCase() ?? '—';
  const currency = order?.currency ?? 'EGP';
  const paymentRefunded =
    refunded || order?.payments?.some((p) => p.status === 'refunded') === true;

  return (
    <div className="page-shell max-w-lg mx-auto pb-8 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={weightedTransition}>
        <div
          className={`size-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
            paymentRefunded ? 'bg-orange-500/10 text-orange-400' : 'bg-emerald-500/10 text-emerald-400'
          }`}
        >
          <span className="material-symbols-outlined text-4xl">
            {paymentRefunded ? 'currency_exchange' : 'check_circle'}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black mb-2">
          {paymentRefunded ? t('checkout.success.refundedTitle') : t('checkout.success.title')}
        </h1>
        <p className="text-muted mb-6">
          {paymentRefunded ? t('checkout.success.refundedSubtitle') : t('checkout.success.subtitle')}
        </p>
        <div className="glass-panel rounded-2xl border border-subtle p-6 space-y-3 mb-8 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-muted">{t('checkout.success.orderNumber')}</span>
            <span className="font-mono font-bold">#{shortId}</span>
          </div>
          {order ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-muted">{t('orders.total')}</span>
                <span className="font-black">{formatShopPrice(order.total, currency, language)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">{t('checkout.success.status')}</span>
                <span className="font-bold capitalize">{order.status.replace('_', ' ')}</span>
              </div>
              {paymentRefunded ? (
                <p className="text-xs text-orange-300/90 rounded-lg bg-orange-500/10 px-3 py-2">
                  {t('orders.demoRefundNote')}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/orders"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-8 text-sm font-black text-white"
          >
            {t('marketplace.viewOrders')}
          </Link>
          <Link
            to="/marketplace"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-subtle px-8 text-sm font-bold text-muted"
          >
            {t('orders.browseShop')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
};
