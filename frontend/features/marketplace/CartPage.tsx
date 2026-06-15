import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import { useCartStore } from '../../store/useCartStore';
import { formatShopPrice, productDisplayPrice } from '../../lib/shopFormat';
import { buttonPress } from '../../lib/motion';
import { decodeShopHtml } from '../../lib/shopDescription';
import { productPagePath } from './productPagePath';
import { useCheckout } from './useCheckout';
import { useCartSync } from './useCartSync';
import { usePendingCheckout } from './usePendingCheckout';
import { CartShippingForm } from './CartShippingForm';
import { readSavedShippingAddress, type ShippingAddress } from './shippingAddressStorage';
import { SHOP_SHELL } from './shopLayout';
import { useShippingRules } from './useShippingRules';
import { computeOrderTotals } from '../../lib/shopShipping';
import type { Product } from '../../types';
import marketplaceService from '../../services/marketplaceService';

const FALLBACK_IMG =
  'https://images.unsplash.com/photo-1593094859027-e9623c44810a?q=80&w=400';

const EMPTY_SHIPPING: ShippingAddress = {
  governorate: '',
  city: '',
  address: '',
  phone: '',
};

function linePrice(product: Product, language: string) {
  return productDisplayPrice(product, language);
}

export const CartPage: React.FC = () => {
  const { t, language } = useI18n();
  const cart = useCartStore();
  const {
    checkout,
    checkingOut,
    error,
    statusMessage,
    priceReviewRequired,
    acknowledgePrices,
  } = useCheckout();
  const { syncing, notice, priceChangeSummary } = useCartSync();
  const { canResume, resumePayment, resumeLabel, resumeHint } = usePendingCheckout();
  const shippingRules = useShippingRules();

  const [shipping, setShipping] = useState<ShippingAddress>(() => readSavedShippingAddress() ?? EMPTY_SHIPPING);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const currency = cart.items[0]?.product.currency ?? shippingRules.currency ?? 'EGP';
  const subtotal = cart.total();
  const discountAmount = appliedCoupon?.discountAmount ?? 0;
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
  const { shippingFee, total: orderTotal } = computeOrderTotals(subtotalAfterDiscount, shippingRules);
  const total = formatShopPrice(orderTotal, currency, language);
  const subtotalLabel = formatShopPrice(subtotal, currency, language);
  const shippingLabel =
    shippingFee === 0
      ? t('marketplace.shippingFree')
      : formatShopPrice(shippingFee, currency, language);

  const checkoutDisabled = checkingOut || syncing || priceReviewRequired;

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code || cart.items.length === 0) return;
    setApplyingCoupon(true);
    setCouponError(null);
    const res = await marketplaceService.validateCoupon(
      code,
      cart.items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
    );
    setApplyingCoupon(false);
    if (res.error || !res.data?.valid) {
      setAppliedCoupon(null);
      setCouponError(res.data?.error ?? res.error ?? t('marketplace.couponInvalid'));
      return;
    }
    setAppliedCoupon({ code: res.data.code ?? code, discountAmount: res.data.discountAmount ?? 0 });
  };

  const priceChangedItems = useMemo(
    () =>
      cart.items.filter(
        (item) => item.addedPrice != null && item.addedPrice !== item.product.price
      ),
    [cart.items]
  );

  return (
    <div className={`${SHOP_SHELL} mx-auto max-w-3xl space-y-4 pb-10 sm:space-y-6`}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-foreground sm:text-3xl">{t('marketplace.cartTitle')}</h1>
          <p className="text-sm text-muted">
            {t('marketplace.cart', { count: String(cart.count()) })}
          </p>
        </div>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-1 rounded-xl border border-subtle px-3 py-2 text-xs font-bold text-muted hover:text-foreground"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          {t('marketplace.continueShopping')}
        </Link>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : null}

      {statusMessage ? (
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
          {statusMessage}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <p>{notice}</p>
          {priceChangeSummary ? <p className="mt-1 text-xs opacity-90">{priceChangeSummary}</p> : null}
        </div>
      ) : null}

      {(priceReviewRequired || priceChangedItems.length > 0) ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 space-y-3">
          <p className="text-sm font-bold text-amber-200">{t('marketplace.priceChanged')}</p>
          <ul className="space-y-1 text-xs text-amber-100/90">
            {priceChangedItems.map((item) => (
              <li key={item.product.id}>
                {decodeShopHtml(item.product.name)}:{' '}
                {formatShopPrice(item.addedPrice ?? item.product.price, currency, language)} →{' '}
                {formatShopPrice(item.product.price, currency, language)}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={acknowledgePrices}
            className="inline-flex min-h-9 items-center rounded-lg bg-amber-500/20 px-3 text-xs font-black uppercase text-amber-100 hover:bg-amber-500/30"
          >
            {t('marketplace.priceAcknowledge')}
          </button>
        </div>
      ) : null}

      {canResume ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-sm font-bold text-foreground">{resumeLabel}</p>
            <p className="text-xs text-muted">{resumeHint}</p>
          </div>
          <button
            type="button"
            onClick={resumePayment}
            className="mt-3 sm:mt-0 inline-flex min-h-10 items-center rounded-xl bg-primary px-4 text-xs font-black uppercase text-white"
          >
            {resumeLabel}
          </button>
        </div>
      ) : null}

      {cart.items.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-subtle px-6 py-16 text-center">
          <span className="material-symbols-outlined mb-3 text-5xl text-muted">shopping_bag</span>
          <p className="text-muted">{t('marketplace.cartEmpty')}</p>
          <Link
            to="/marketplace"
            className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-6 text-sm font-black uppercase text-white"
          >
            {t('marketplace.continueShopping')}
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {cart.items.map((item) => {
              const title =
                language === 'ar' && item.product.nameAr
                  ? decodeShopHtml(item.product.nameAr)
                  : decodeShopHtml(item.product.name);
              const productTo = productPagePath(item.product);
              const priceChanged =
                item.addedPrice != null && item.addedPrice !== item.product.price;

              return (
                <li
                  key={item.product.id}
                  className="flex items-center gap-3 rounded-2xl border border-subtle bg-elevated/80 p-3 sm:p-4"
                >
                  {productTo ? (
                    <Link to={productTo} className="shrink-0">
                      <img
                        src={item.product.imageUrl || FALLBACK_IMG}
                        alt=""
                        className="size-16 rounded-xl object-cover sm:size-20"
                      />
                    </Link>
                  ) : (
                    <img
                      src={item.product.imageUrl || FALLBACK_IMG}
                      alt=""
                      className="size-16 shrink-0 rounded-xl object-cover sm:size-20"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    {productTo ? (
                      <Link to={productTo} className="block truncate font-bold text-sm hover:text-primary">
                        {title}
                      </Link>
                    ) : (
                      <p className="truncate font-bold text-sm">{title}</p>
                    )}
                    <p className="text-xs text-muted">
                      {item.product.brand} · {linePrice(item.product, language)}
                    </p>
                    {priceChanged ? (
                      <p className="mt-1 text-[10px] font-bold uppercase text-amber-400">
                        {t('marketplace.priceChangedBadge')}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      {formatShopPrice(item.product.price * item.quantity, currency, language)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={item.quantity}
                      onChange={(e) =>
                        cart.setQuantity(item.product.id, Number(e.target.value) || 1)
                      }
                      className="w-14 rounded-lg border border-subtle bg-elevated px-1 py-1 text-center text-sm font-bold"
                      aria-label={t('shop.increaseQty')}
                    />
                    <button
                      type="button"
                      onClick={() => cart.remove(item.product.id)}
                      className="text-muted hover:text-red-400"
                      aria-label={t('marketplace.removeItem')}
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <CartShippingForm value={shipping} onChange={setShipping} disabled={checkingOut || syncing} />

          <div className="glass-panel space-y-3 rounded-2xl border border-subtle p-4">
            <label className="text-xs font-bold uppercase text-muted" htmlFor="coupon-code">
              {t('marketplace.couponCode')}
            </label>
            <div className="flex gap-2">
              <input
                id="coupon-code"
                type="text"
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(e.target.value.toUpperCase());
                  setCouponError(null);
                }}
                placeholder="WELCOME10"
                className="min-h-10 flex-1 rounded-xl border border-subtle bg-elevated px-3 text-sm font-mono uppercase"
                disabled={checkingOut || syncing}
              />
              <button
                type="button"
                onClick={() => void applyCoupon()}
                disabled={applyingCoupon || !couponInput.trim() || cart.items.length === 0}
                className="min-h-10 shrink-0 rounded-xl border border-primary/40 px-4 text-xs font-black uppercase text-primary disabled:opacity-50"
              >
                {t('marketplace.couponApply')}
              </button>
            </div>
            {couponError ? <p className="text-xs text-red-400">{couponError}</p> : null}
            {appliedCoupon ? (
              <p className="text-xs text-emerald-400">{t('marketplace.couponApplied')}: {appliedCoupon.code}</p>
            ) : null}
          </div>

          <div className="glass-panel space-y-4 rounded-2xl border border-primary/25 p-5 sm:p-6">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">{t('marketplace.subtotal')}</span>
                <span className="font-bold tabular-nums">{subtotalLabel}</span>
              </div>
              {discountAmount > 0 ? (
                <div className="flex items-center justify-between text-emerald-400">
                  <span>{t('marketplace.discount')}</span>
                  <span className="font-bold tabular-nums">
                    −{formatShopPrice(discountAmount, currency, language)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-muted">{t('marketplace.shippingFee')}</span>
                <span className={`font-bold tabular-nums ${shippingFee === 0 ? 'text-emerald-400' : ''}`}>
                  {shippingLabel}
                </span>
              </div>
              {shippingFee > 0 && subtotal > 0 ? (
                <p className="text-[11px] text-muted">
                  {t('marketplace.freeShippingHint', {
                    amount: formatShopPrice(shippingRules.freeShippingMin, currency, language),
                  })}
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between border-t border-subtle pt-3 text-lg font-black">
              <span>{t('marketplace.total')}</span>
              <span className="text-[#f37021]">{total}</span>
            </div>
            <p className="text-xs text-muted">{t('marketplace.checkoutHint')}</p>
            <motion.button
              type="button"
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              disabled={checkoutDisabled}
              onClick={() =>
                void checkout(shipping, orderTotal, {
                  couponCode: appliedCoupon?.code,
                })
              }
              className="flex w-full min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-black uppercase text-white disabled:opacity-50"
            >
              <span className="material-symbols-outlined">lock</span>
              {checkingOut ? t('marketplace.placingOrder') : t('marketplace.checkout')}
            </motion.button>
            <Link
              to="/orders"
              className="block text-center text-xs font-bold text-primary hover:underline"
            >
              {t('marketplace.viewOrders')}
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

export default CartPage;
