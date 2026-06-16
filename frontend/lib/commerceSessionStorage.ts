import type { OrderSource } from './orderAttribution';

const DISMISS_KEY = 'taqwin.commerce.dismissed';
const BUNDLE_KEY = 'taqwin.commerce.pendingBundle';

export interface PendingCommerceBundle {
  sessionId: string;
  bundleId: string;
  productIds: string[];
  discountPercent: number;
  source: OrderSource;
  abVariant?: string;
  experimentId?: string;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function isBundleDismissed(sessionId: string): boolean {
  const list = readJson<string[]>(DISMISS_KEY) ?? [];
  return list.includes(sessionId);
}

export function dismissCommerceBundle(sessionId: string) {
  const list = readJson<string[]>(DISMISS_KEY) ?? [];
  if (!list.includes(sessionId)) list.push(sessionId);
  if (list.length > 20) list.splice(0, list.length - 20);
  writeJson(DISMISS_KEY, list);
}

export function savePendingCommerceBundle(bundle: PendingCommerceBundle) {
  writeJson(BUNDLE_KEY, bundle);
}

export function readPendingCommerceBundle(): PendingCommerceBundle | null {
  return readJson<PendingCommerceBundle>(BUNDLE_KEY);
}

export function clearPendingCommerceBundle() {
  try {
    localStorage.removeItem(BUNDLE_KEY);
  } catch {
    /* ignore */
  }
}
