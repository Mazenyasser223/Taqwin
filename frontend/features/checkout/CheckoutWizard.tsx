import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { useCartStore } from '../../store/useCartStore';
import { formatShopPrice } from '../../lib/shopFormat';
import marketplaceService from '../../services/marketplaceService';
import type { CheckoutPreview, PaymentMethod, ShippingAddress } from '../../types';
import { EGYPT_GOVERNORATES } from './egyptGovernorates';
import { weightedTransition } from '../../lib/motion';

const STEPS = ['cart', 'address', 'shipping', 'payment'] as const;
type Step = (typeof STEPS)[number];

const PAYMENT_OPTIONS: { id: PaymentMethod; icon: string }[] = [
  { id: 'cod', icon: 'local_shipping' },
  { id: 'card', icon: 'credit_card' },
  { id: 'fawry', icon: 'storefront' },
  { id: 'wallet', icon: 'account_balance_wallet' },
];

const EMPTY_SHIPPING: ShippingAddress = {
  governorate: 'Cairo',
  city: '',
  address: '',
  phone: '',
};

export const CheckoutWizard: React.FC = () => {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const cart = useCartStore();
  const [step, setStep] = useState<Step>('cart');
  const [shipping, setShipping] = useState<ShippingAddress>(EMPTY_SHIPPING);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = cart.items;
  const stepIndex = STEPS.indexOf(step);

  useEffect(() => {
    if (items.length === 0 && step === 'cart') {
      navigate('/marketplace', { replace: true });
    }
  }, [items.length, step, navigate]);

  const cartItemsPayload = useMemo(
    () => items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
    [items]
  );

  const loadPreview = useCallback(async () => {
    if (!shipping.governorate || items.length === 0) return;
    setLoadingPreview(true);
    setError(null);
    const res = await marketplaceService.previewCheckout({
      items: cartItemsPayload,
      governorate: shipping.governorate,
    });
    setLoadingPreview(false);
    if (res.error) {
      setError(res.error);
      setPreview(null);
    } else {
      setPreview(res.data ?? null);
    }
  }, [cartItemsPayload, items.length, shipping.governorate]);

  useEffect(() => {
    if (step === 'shipping' || step === 'payment') {
      void loadPreview();
    }
  }, [step, loadPreview]);

  const subtotal = items.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const currency = items[0]?.product.currency ?? 'EGP';

  const canContinueAddress =
    shipping.city.trim().length >= 2 &&
    shipping.address.trim().length >= 5 &&
    shipping.phone.trim().length >= 10;

  const handlePlaceOrder = async () => {
    if (items.length === 0) return;
    setSubmitting(true);
    setError(null);
    const res = await marketplaceService.createOrder({
      items: cartItemsPayload,
      shipping,
      paymentMethod,
    });
    setSubmitting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const order = res.data!;
    cart.clear();
    if (order.needsPayment) {
      navigate(`/checkout/pay/${order.id}`, { replace: true });
    } else {
      navigate(`/checkout/success?order=${order.id}`, { replace: true });
    }
  };

  return (
    <div className="page-shell max-w-2xl mx-auto pb-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={weightedTransition}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-1">
              {t('checkout.badge')}
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">{t('checkout.title')}</h1>
          </div>
          <Link to="/marketplace" className="text-sm font-bold text-muted hover:text-primary">
            {t('checkout.backToShop')}
          </Link>
        </div>

        <div className="mb-8 flex gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-primary' : 'bg-elevated'}`}
            />
          ))}
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200/90 mb-6">
          {t('checkout.demoBanner')}
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        <div className="glass-panel rounded-2xl border border-subtle p-5 sm:p-8 space-y-6">
          {step === 'cart' ? (
            <>
              <h2 className="text-lg font-black">{t('checkout.step.cart')}</h2>
              {items.length === 0 ? (
                <p className="text-muted">{t('marketplace.cartEmpty')}</p>
              ) : (
                <ul className="space-y-4">
                  {items.map((item) => (
                    <li key={item.product.id} className="flex gap-4 items-center">
                      {item.product.imageUrl ? (
                        <img
                          src={item.product.imageUrl}
                          alt=""
                          className="size-16 rounded-xl object-cover bg-elevated"
                        />
                      ) : (
                        <div className="size-16 rounded-xl bg-elevated flex items-center justify-center">
                          <span className="material-symbols-outlined text-muted">inventory_2</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{item.product.name}</p>
                        <p className="text-xs text-muted">
                          × {item.quantity} · {formatShopPrice(item.product.price, currency, language)}
                        </p>
                      </div>
                      <p className="font-black tabular-nums">
                        {formatShopPrice(item.product.price * item.quantity, currency, language)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-between border-t border-subtle pt-4 font-bold">
                <span>{t('marketplace.total')}</span>
                <span>{formatShopPrice(subtotal, currency, language)}</span>
              </div>
              <button
                type="button"
                disabled={items.length === 0}
                onClick={() => setStep('address')}
                className="w-full rounded-2xl bg-primary py-3.5 font-black text-white disabled:opacity-50"
              >
                {t('checkout.continue')}
              </button>
            </>
          ) : null}

          {step === 'address' ? (
            <>
              <h2 className="text-lg font-black">{t('checkout.step.address')}</h2>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-muted">{t('checkout.governorate')}</span>
                <select
                  value={shipping.governorate}
                  onChange={(e) => setShipping((s) => ({ ...s, governorate: e.target.value }))}
                  className="w-full rounded-xl border border-subtle bg-elevated px-3 py-2.5"
                >
                  {EGYPT_GOVERNORATES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-muted">{t('checkout.city')}</span>
                <input
                  value={shipping.city}
                  onChange={(e) => setShipping((s) => ({ ...s, city: e.target.value }))}
                  className="w-full rounded-xl border border-subtle bg-elevated px-3 py-2.5"
                  placeholder={t('checkout.cityPlaceholder')}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-muted">{t('checkout.address')}</span>
                <textarea
                  value={shipping.address}
                  onChange={(e) => setShipping((s) => ({ ...s, address: e.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-subtle bg-elevated px-3 py-2.5 resize-none"
                  placeholder={t('checkout.addressPlaceholder')}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase text-muted">{t('checkout.phone')}</span>
                <input
                  value={shipping.phone}
                  onChange={(e) => setShipping((s) => ({ ...s, phone: e.target.value }))}
                  type="tel"
                  className="w-full rounded-xl border border-subtle bg-elevated px-3 py-2.5"
                  placeholder="+201012345678"
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('cart')}
                  className="flex-1 rounded-2xl border border-subtle py-3 font-bold text-muted"
                >
                  {t('checkout.back')}
                </button>
                <button
                  type="button"
                  disabled={!canContinueAddress}
                  onClick={() => setStep('shipping')}
                  className="flex-1 rounded-2xl bg-primary py-3 font-black text-white disabled:opacity-50"
                >
                  {t('checkout.continue')}
                </button>
              </div>
            </>
          ) : null}

          {step === 'shipping' ? (
            <>
              <h2 className="text-lg font-black">{t('checkout.step.shipping')}</h2>
              {loadingPreview ? (
                <p className="text-primary animate-pulse">{t('checkout.loadingShipping')}</p>
              ) : preview ? (
                <div className="space-y-3 text-sm">
                  <p className="text-muted">{t('checkout.deliveryTo', { city: shipping.city, governorate: shipping.governorate })}</p>
                  <div className="flex justify-between">
                    <span>{t('checkout.subtotal')}</span>
                    <span>{formatShopPrice(preview.subtotal, preview.currency, language)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('checkout.shippingFee')}</span>
                    <span>
                      {preview.freeShippingApplied
                        ? t('checkout.freeShipping')
                        : formatShopPrice(preview.shippingFee, preview.currency, language)}
                    </span>
                  </div>
                  <p className="text-muted text-xs">{t('checkout.estimatedDays', { days: preview.estimatedDays })}</p>
                  <div className="flex justify-between border-t border-subtle pt-3 text-lg font-black">
                    <span>{t('marketplace.total')}</span>
                    <span>{formatShopPrice(preview.total, preview.currency, language)}</span>
                  </div>
                </div>
              ) : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('address')}
                  className="flex-1 rounded-2xl border border-subtle py-3 font-bold text-muted"
                >
                  {t('checkout.back')}
                </button>
                <button
                  type="button"
                  disabled={!preview || loadingPreview}
                  onClick={() => setStep('payment')}
                  className="flex-1 rounded-2xl bg-primary py-3 font-black text-white disabled:opacity-50"
                >
                  {t('checkout.continue')}
                </button>
              </div>
            </>
          ) : null}

          {step === 'payment' ? (
            <>
              <h2 className="text-lg font-black">{t('checkout.step.payment')}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      paymentMethod === opt.id
                        ? 'border-primary bg-primary/10'
                        : 'border-subtle hover:border-primary/30'
                    }`}
                  >
                    <span className="material-symbols-outlined text-primary">{opt.icon}</span>
                    <div>
                      <p className="font-bold text-sm">{t(`checkout.payment.${opt.id}`)}</p>
                      <p className="text-xs text-muted">{t(`checkout.payment.${opt.id}Hint`)}</p>
                    </div>
                  </button>
                ))}
              </div>
              {preview ? (
                <div className="flex justify-between border-t border-subtle pt-4 text-lg font-black">
                  <span>{t('marketplace.total')}</span>
                  <span>{formatShopPrice(preview.total, preview.currency, language)}</span>
                </div>
              ) : null}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('shipping')}
                  className="flex-1 rounded-2xl border border-subtle py-3 font-bold text-muted"
                >
                  {t('checkout.back')}
                </button>
                <button
                  type="button"
                  disabled={submitting || !preview}
                  onClick={() => void handlePlaceOrder()}
                  className="flex-1 rounded-2xl bg-primary py-3 font-black text-white disabled:opacity-50"
                >
                  {submitting ? t('marketplace.placingOrder') : t('checkout.placeOrder')}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
};
