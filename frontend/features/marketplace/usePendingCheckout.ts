import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import marketplaceService from '../../services/marketplaceService';
import { useCartStore } from '../../store/useCartStore';
import {
  clearPendingCheckout,
  pendingCheckoutMatchesCart,
  readPendingCheckout,
  type PendingCheckoutSession,
} from './cartCheckoutSession';

export function usePendingCheckout() {
  const { t } = useI18n();
  const items = useCartStore((s) => s.items);
  const [session, setSession] = useState<PendingCheckoutSession | null>(() => readPendingCheckout());

  useEffect(() => {
    setSession(readPendingCheckout());
  }, [items]);

  useEffect(() => {
    if (!session || !pendingCheckoutMatchesCart(session, items)) return;

    let cancelled = false;

    (async () => {
      const res = await marketplaceService.getOrder(session.orderId);
      if (cancelled) return;

      if (res.error || !res.data) {
        clearPendingCheckout();
        setSession(null);
        return;
      }

      if (res.data.paymentStatus !== 'pending') {
        clearPendingCheckout();
        setSession(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, items]);

  const resumePayment = useCallback(() => {
    if (!session?.checkoutUrl) return;
    window.location.href = session.checkoutUrl;
  }, [session]);

  const visible = Boolean(session && pendingCheckoutMatchesCart(session, items));

  return {
    canResume: visible,
    resumePayment,
    resumeLabel: t('marketplace.resumePayment'),
    resumeHint: t('marketplace.resumePaymentHint'),
  };
}
