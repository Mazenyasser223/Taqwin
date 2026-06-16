import { useEffect, useState } from 'react';
import marketplaceService from '../../services/marketplaceService';
import type { Order, PaymentStatus } from '../../types';

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 15;

export function normalizePaymentStatus(status: string | undefined): PaymentStatus {
  if (status === 'paid' || status === 'failed' || status === 'refunded' || status === 'pending') {
    return status;
  }
  return 'pending';
}

export function usePaymentOrderPoll(orderId: string | null) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError('missing_order');
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const res = await marketplaceService.getOrder(orderId);
      if (cancelled) return;

      if (res.error || !res.data) {
        setOrder(null);
        setError(res.error ?? 'load_failed');
        setLoading(false);
        return;
      }

      setOrder(res.data);
      const status = normalizePaymentStatus(res.data.paymentStatus);
      if (status === 'paid' || status === 'failed') {
        setLoading(false);
        return;
      }

      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) {
        setLoading(false);
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  return { order, loading, error };
}
