import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { usePaymentOrderPoll } from './usePaymentOrderPoll';
import { useCartStore } from '../../store/useCartStore';
import { clearPendingCheckout } from '../marketplace/cartCheckoutSession';

export const PaymentSuccess: React.FC = () => {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const paymobFailed = searchParams.get('success') === 'false';
  const { order, loading, error } = usePaymentOrderPoll(orderId);

  React.useEffect(() => {
    if (paymobFailed && orderId) {
      navigate(`/payment/failed?orderId=${orderId}`, { replace: true });
    }
  }, [paymobFailed, orderId, navigate]);

  React.useEffect(() => {
    if (!loading && order?.paymentStatus === 'failed') {
      navigate(`/payment/failed?orderId=${order.id}`, { replace: true });
    }
  }, [loading, order, navigate]);

  React.useEffect(() => {
    if (order?.paymentStatus === 'paid') {
      useCartStore.getState().clear();
      clearPendingCheckout();
    }
  }, [order?.paymentStatus, order?.id]);

  const locale = language === 'ar' ? 'ar-EG' : 'en-US';
  const currency = order ? orderDisplayCurrency(order) : 'EGP';
  const successSubtotal = order ? orderItemsSubtotal(order) : 0;
  const successShipping = order ? orderShippingFee(order) : 0;
  const successTotal = order ? orderGrandTotal(order) : 0;

  return (
    <div className="page-shell max-w-lg mx-auto pb-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={weightedTransition}
        className="glass-panel rounded-3xl p-8 sm:p-10 text-center space-y-6"
      >
        {loading ? (
          <>
            <div className="size-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <span className="material-symbols-outlined text-4xl text-primary">hourglass_top</span>
            </div>
            <h1 className="text-2xl font-black text-foreground">{t('payment.verifying')}</h1>
            <p className="text-muted">{t('payment.verifyingHint')}</p>
          </>
        ) : error || !order ? (
          <>
            <div className="size-20 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-amber-400">error</span>
            </div>
            <h1 className="text-2xl font-black text-foreground">{t('payment.verifyError')}</h1>
            <Link to="/orders" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-6 text-sm font-black uppercase text-white">
              {t('payment.viewOrders')}
            </Link>
          </>
        ) : order.paymentStatus === 'paid' ? (
          <>
            <div className="size-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-emerald-400">check_circle</span>
            </div>
            <h1 className="text-3xl font-black text-foreground">{t('payment.successTitle')}</h1>
            <p className="text-muted">{t('payment.successSubtitle')}</p>
            <div className="rounded-2xl border border-subtle bg-black/20 p-4 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-faint">{t('payment.orderRef')}</p>
              <p className="font-black text-foreground">#{order.id.slice(0, 8)}</p>
              <p className="text-2xl font-black text-primary tabular-nums">
                {formatShopPrice(successTotal, currency, language)}
              </p>
              <div className="mt-2 space-y-0.5 text-xs text-muted">
                <p>
                  {t('marketplace.subtotal')}: {formatShopPrice(successSubtotal, currency, language)}
                </p>
                <p>
                  {t('marketplace.shippingFee')}:{' '}
                  {successShipping <= 0
                    ? t('marketplace.shippingFree')
                    : formatShopPrice(successShipping, currency, language)}
                </p>
              </div>
              {order.paidAt ? (
                <p className="text-xs text-faint">
                  {new Date(order.paidAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to={`/orders/${order.id}`}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-6 text-sm font-black uppercase text-white"
              >
                <span className="material-symbols-outlined text-base">timeline</span>
                {t('payment.viewOrderDetails')}
              </Link>
              <Link
                to="/orders"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-subtle px-6 text-sm font-black uppercase text-foreground"
              >
                {t('payment.viewOrders')}
              </Link>
              <Link
                to="/marketplace"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-subtle px-6 text-sm font-black uppercase text-foreground"
              >
                {t('payment.continueShopping')}
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="size-20 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-4xl text-amber-400">schedule</span>
            </div>
            <h1 className="text-2xl font-black text-foreground">{t('payment.pendingTitle')}</h1>
            <p className="text-muted">{t('payment.pendingSubtitle')}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to={`/orders/${order.id}`}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-6 text-sm font-black uppercase text-white"
              >
                <span className="material-symbols-outlined text-base">timeline</span>
                {t('payment.viewOrderDetails')}
              </Link>
              <Link
                to="/orders"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-subtle px-6 text-sm font-black uppercase text-foreground"
              >
                {t('payment.viewOrders')}
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export const PaymentFailed: React.FC = () => {
  const { t, language } = useI18n();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { order, loading } = usePaymentOrderPoll(orderId);
  const currency = order?.items?.[0]?.product?.currency ?? 'EGP';

  React.useEffect(() => {
    clearPendingCheckout();
  }, []);

  return (
    <div className="page-shell max-w-lg mx-auto pb-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={weightedTransition}
        className="glass-panel rounded-3xl p-8 sm:p-10 text-center space-y-6"
      >
        <div className="size-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-4xl text-red-400">cancel</span>
        </div>
        <h1 className="text-3xl font-black text-foreground">{t('payment.failedTitle')}</h1>
        <p className="text-muted">{t('payment.failedSubtitle')}</p>
        {!loading && order ? (
          <p className="text-sm text-faint">
            #{order.id.slice(0, 8)} · {formatShopPrice(Number(order.total) || 0, currency, language)}
          </p>
        ) : null}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/marketplace/cart"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-black uppercase text-white"
          >
            {t('payment.tryAgain')}
          </Link>
          <Link
            to="/orders"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-subtle px-6 text-sm font-black uppercase text-foreground"
          >
            {t('payment.viewOrders')}
          </Link>
        </div>
      </motion.div>
    </div>
  );
};
