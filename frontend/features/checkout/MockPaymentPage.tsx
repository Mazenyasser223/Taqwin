import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { formatShopPrice } from '../../lib/shopFormat';
import marketplaceService from '../../services/marketplaceService';
import type { CheckoutConfig, Order } from '../../types';
import { weightedTransition } from '../../lib/motion';

export const MockPaymentPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const cancelled = searchParams.get('cancelled') === '1';
  const navigate = useNavigate();
  const { t, language } = useI18n();
  const [order, setOrder] = useState<Order | null>(null);
  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentProvider = order?.payments?.[0]?.provider;
  const useStripe = paymentProvider === 'stripe' && config?.stripeEnabled;

  useEffect(() => {
    if (!orderId) return;
    void Promise.all([
      marketplaceService.getOrder(orderId),
      marketplaceService.getCheckoutConfig(),
    ]).then(([orderRes, configRes]) => {
      setLoading(false);
      if (configRes.data) setConfig(configRes.data);
      if (orderRes.error || !orderRes.data) {
        setError(orderRes.error ?? t('checkout.orderNotFound'));
        return;
      }
      if (orderRes.data.status !== 'pending_payment') {
        navigate(`/checkout/success?order=${orderId}`, { replace: true });
        return;
      }
      setOrder(orderRes.data);
    });
  }, [orderId, navigate, t]);

  const handleMockPay = async () => {
    if (!orderId) return;
    setPaying(true);
    setError(null);
    const res = await marketplaceService.confirmPayment(orderId);
    setPaying(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const autoRefunded = res.data?.autoRefunded || res.data?.payments?.[0]?.status === 'refunded';
    navigate(
      `/checkout/success?order=${orderId}${autoRefunded ? '&refunded=1' : ''}`,
      { replace: true }
    );
  };

  const handleStripePay = async () => {
    if (!orderId) return;
    setPaying(true);
    setError(null);
    const res = await marketplaceService.createStripeSession(orderId);
    setPaying(false);
    if (res.error || !res.data?.url) {
      setError(res.error ?? t('checkout.stripe.sessionFailed'));
      return;
    }
    window.location.href = res.data.url;
  };

  const stripeHint = useMemo(() => {
    if (!config?.stripeTestMode) return t('checkout.stripe.liveHint');
    return t('checkout.stripe.testHint');
  }, [config?.stripeTestMode, t]);

  const currency = order?.currency ?? 'EGP';

  return (
    <div className="page-shell max-w-md mx-auto pb-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={weightedTransition}>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-1">
          {useStripe ? t('checkout.stripe.badge') : t('checkout.mockPay.badge')}
        </p>
        <h1 className="text-2xl font-black mb-2">
          {useStripe ? t('checkout.stripe.title') : t('checkout.mockPay.title')}
        </h1>
        <p className="text-sm text-muted mb-6">
          {useStripe ? t('checkout.stripe.subtitle') : t('checkout.mockPay.subtitle')}
        </p>

        {cancelled ? (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {t('checkout.stripe.cancelled')}
          </div>
        ) : null}

        {loading ? (
          <p className="text-primary animate-pulse">{t('checkout.loading')}</p>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        {order ? (
          <div className="glass-panel rounded-2xl border border-subtle p-6 space-y-5">
            <div className="flex justify-between items-center">
              <span className="text-muted text-sm">{t('marketplace.total')}</span>
              <span className="text-2xl font-black">
                {formatShopPrice(order.total, currency, language)}
              </span>
            </div>
            <p className="text-xs text-amber-300/90 rounded-lg bg-amber-500/10 px-3 py-2">
              {t('checkout.demoBanner')}
            </p>

            {useStripe ? (
              <>
                <p className="text-xs text-orange-300/80 rounded-lg bg-orange-500/5 px-3 py-2 border border-orange-500/10">
                  {config?.autoRefundEnabled ? t('checkout.stripe.refundHint') : stripeHint}
                </p>
                <div className="rounded-xl border border-subtle bg-elevated/50 p-4 text-sm text-muted space-y-2">
                  <p className="font-bold text-foreground">{t('checkout.stripe.testCardTitle')}</p>
                  <p className="font-mono text-xs">4242 4242 4242 4242</p>
                  <p>{t('checkout.stripe.testCardMeta')}</p>
                </div>
                <button
                  type="button"
                  disabled={paying}
                  onClick={() => void handleStripePay()}
                  className="w-full rounded-2xl bg-primary py-3.5 font-black text-white disabled:opacity-50"
                >
                  {paying ? t('checkout.mockPay.processing') : t('checkout.stripe.continue')}
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-orange-300/80 rounded-lg bg-orange-500/5 px-3 py-2 border border-orange-500/10">
                  {t('checkout.mockPay.refundHint')}
                </p>
                <label className="block space-y-1">
                  <span className="text-xs font-bold uppercase text-muted">{t('checkout.mockPay.card')}</span>
                  <input
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full rounded-xl border border-subtle bg-elevated px-3 py-2.5 font-mono text-sm"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1">
                    <span className="text-xs font-bold uppercase text-muted">{t('checkout.mockPay.expiry')}</span>
                    <input defaultValue="12/30" className="w-full rounded-xl border border-subtle bg-elevated px-3 py-2.5 text-sm" readOnly />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs font-bold uppercase text-muted">CVV</span>
                    <input defaultValue="123" className="w-full rounded-xl border border-subtle bg-elevated px-3 py-2.5 text-sm" readOnly />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={paying}
                  onClick={() => void handleMockPay()}
                  className="w-full rounded-2xl bg-primary py-3.5 font-black text-white disabled:opacity-50"
                >
                  {paying ? t('checkout.mockPay.processing') : t('checkout.mockPay.pay')}
                </button>
              </>
            )}

            <Link to="/orders" className="block text-center text-sm text-muted hover:text-primary">
              {t('marketplace.viewOrders')}
            </Link>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
};
