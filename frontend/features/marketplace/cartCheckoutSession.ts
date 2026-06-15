import type { CartItem } from '../../store/useCartStore';

const STORAGE_KEY = 'taqwin_pending_checkout';
const MAX_AGE_MS = 60 * 60 * 1000;

export interface PendingCheckoutSession {
  orderId: string;
  checkoutUrl: string;
  fingerprint: string;
  createdAt: number;
}

export function cartFingerprint(items: CartItem[]): string {
  return JSON.stringify(
    items
      .map((item) => ({ id: item.product.id, q: item.quantity }))
      .sort((a, b) => a.id.localeCompare(b.id))
  );
}

export function savePendingCheckout(session: Omit<PendingCheckoutSession, 'createdAt'>) {
  if (typeof sessionStorage === 'undefined') return;
  const payload: PendingCheckoutSession = { ...session, createdAt: Date.now() };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function readPendingCheckout(): PendingCheckoutSession | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingCheckoutSession;
    if (!parsed?.orderId || !parsed?.checkoutUrl || !parsed?.fingerprint) return null;
    if (Date.now() - parsed.createdAt > MAX_AGE_MS) {
      clearPendingCheckout();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingCheckout() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function pendingCheckoutMatchesCart(
  session: PendingCheckoutSession | null,
  items: CartItem[]
): session is PendingCheckoutSession {
  if (!session) return false;
  return session.fingerprint === cartFingerprint(items);
}
