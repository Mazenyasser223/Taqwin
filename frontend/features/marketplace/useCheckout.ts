import { useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import marketplaceService from '../../services/marketplaceService';
import { useCartStore } from '../../store/useCartStore';
import {
  acknowledgePriceChanges,
  refreshCartItems,
} from './cartPriceUtils';
import {
  cartFingerprint,
  clearPendingCheckout,
  pendingCheckoutMatchesCart,
  readPendingCheckout,
  savePendingCheckout,
} from './cartCheckoutSession';
import {
  normalizeShippingPhone,
  saveShippingAddress,
  validateShippingAddress,
  type ShippingAddress,
} from './shippingAddressStorage';
import { readPendingCommerceBundle } from '../../lib/commerceSessionStorage';
import { getShopAttribution, resolveCheckoutSource } from '../../lib/orderAttribution';
import { getFunnelSessionId, trackShopFunnel } from '../../lib/shopFunnel';

const TOTAL_EPSILON = 0.01;

export interface CheckoutOptions {
  couponCode?: string;
  loyaltyPointsUsed?: number;
}

export function useCheckout() {
  const { t } = useI18n();
  const cart = useCartStore();
  const [checkingOut, setCheckingOut] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [priceReviewRequired, setPriceReviewRequired] = useState(false);

  const checkout = async (
    shipping: ShippingAddress,
    expectedTotal: number,
    opts?: CheckoutOptions,
  ) => {
    if (cart.items.length === 0) return;

    const shippingError = validateShippingAddress(shipping, t);
    if (shippingError) {
      setError(shippingError);
      return;
    }

    setCheckingOut(true);
    setError(null);
    setStatusMessage(null);

    const refreshed = await refreshCartItems(cart.items);
    if (refreshed.removedCount > 0) {
      cart.replaceItems(refreshed.items);
      setCheckingOut(false);
      setError(t('marketplace.cartItemsRemoved', { count: String(refreshed.removedCount) }));
      return;
    }

    if (refreshed.priceChanges.length > 0) {
      cart.replaceItems(refreshed.items);
      setPriceReviewRequired(true);
      setCheckingOut(false);
      setError(t('marketplace.priceChangedCheckout'));
      return;
    }

    cart.replaceItems(refreshed.items);

    const pending = readPendingCheckout();
    if (pending && pendingCheckoutMatchesCart(pending, cart.items)) {
      const orderRes = await marketplaceService.getOrder(pending.orderId);
      if (orderRes.data?.paymentStatus === 'pending') {
        saveShippingAddress(shipping);
        setStatusMessage(t('marketplace.redirectingToPayment'));
        window.location.href = pending.checkoutUrl;
        return;
      }
      clearPendingCheckout();
    }

    const normalizedShipping: ShippingAddress = {
      ...shipping,
      phone: normalizeShippingPhone(shipping.phone),
    };

    const pendingBundle = readPendingCommerceBundle();
    const cartProductIds = cart.items.map((i) => i.product.id).sort();
    const bundleMatch =
      pendingBundle &&
      pendingBundle.productIds.length >= 2 &&
      pendingBundle.productIds.length === cartProductIds.length &&
      [...pendingBundle.productIds].sort().every((id, idx) => id === cartProductIds[idx]);

    const res = await marketplaceService.createPaymentSession({
      items: cart.items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      shipping: normalizedShipping,
      commerceSource: resolveCheckoutSource({
        bundleMatch: Boolean(bundleMatch),
        pendingSource: pendingBundle?.source,
        shopContext: getShopAttribution(),
      }),
      funnelSessionId: getFunnelSessionId(),
      ...(opts?.couponCode ? { couponCode: opts.couponCode } : {}),
      ...(opts?.loyaltyPointsUsed ? { loyaltyPointsUsed: opts.loyaltyPointsUsed } : {}),
      ...(bundleMatch && pendingBundle
        ? {
            aiBundle: {
              productIds: pendingBundle.productIds,
              sessionId: pendingBundle.sessionId,
              abVariant: pendingBundle.abVariant,
              experimentId: pendingBundle.experimentId,
            },
          }
        : {}),
    });

    setCheckingOut(false);

    if (res.error || !res.data?.checkoutUrl) {
      setError(res.error ?? t('marketplace.paymentError'));
      return;
    }

    if (Math.abs(res.data.total - expectedTotal) > TOTAL_EPSILON) {
      setError(t('marketplace.checkoutTotalMismatch'));
      return;
    }

    saveShippingAddress(normalizedShipping);
    void trackShopFunnel('checkout_start');
    savePendingCheckout({
      orderId: res.data.orderId,
      checkoutUrl: res.data.checkoutUrl,
      fingerprint: cartFingerprint(cart.items),
    });

    setStatusMessage(t('marketplace.redirectingToPayment'));
    window.location.href = res.data.checkoutUrl;
  };

  const acknowledgePrices = () => {
    cart.replaceItems(acknowledgePriceChanges(cart.items));
    setPriceReviewRequired(false);
    setError(null);
  };

  return {
    checkout,
    checkingOut,
    error,
    statusMessage,
    priceReviewRequired,
    acknowledgePrices,
    clearError: () => setError(null),
  };
}
