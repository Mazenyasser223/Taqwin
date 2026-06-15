/**
 * Shop conversion funnel — client session + event tracking.
 */
const STORAGE_KEY = 'taqwin_shop_funnel_session';

export type ShopFunnelStep =
  | 'visit'
  | 'search'
  | 'product_view'
  | 'add_to_cart'
  | 'checkout_start'
  | 'paid';

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getFunnelSessionId(): string {
  try {
    let id = sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

export async function trackShopFunnel(
  step: ShopFunnelStep,
  extra?: { productId?: string; query?: string; metadata?: Record<string, unknown> },
) {
  try {
    const base = import.meta.env.VITE_API_URL || '';
    await fetch(`${base}/api/marketplace/funnel/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        sessionId: getFunnelSessionId(),
        step,
        productId: extra?.productId,
        query: extra?.query,
        metadata: extra?.metadata,
      }),
    });
  } catch {
    /* non-blocking analytics */
  }
}
