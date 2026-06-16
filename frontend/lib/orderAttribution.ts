export type OrderSource =
  | 'ai_bundle'
  | 'ai_recommendation'
  | 'search'
  | 'category'
  | 'featured'
  | 'direct';

const CONTEXT_KEY = 'taqwin.shop.attribution';

export function setShopAttribution(source: OrderSource) {
  try {
    sessionStorage.setItem(CONTEXT_KEY, source);
  } catch {
    /* ignore */
  }
}

export function getShopAttribution(): OrderSource {
  try {
    const v = sessionStorage.getItem(CONTEXT_KEY);
    if (
      v === 'search' ||
      v === 'category' ||
      v === 'featured' ||
      v === 'direct' ||
      v === 'ai_recommendation' ||
      v === 'ai_bundle'
    ) {
      return v;
    }
  } catch {
    /* ignore */
  }
  return 'direct';
}

export function resolveCheckoutSource(opts: {
  bundleMatch?: boolean;
  pendingSource?: string;
  shopContext?: OrderSource;
}): OrderSource {
  if (opts.bundleMatch) return 'ai_bundle';
  const pending = opts.pendingSource as OrderSource | undefined;
  if (pending === 'ai_recommendation' || pending === 'ai_bundle') return pending;
  return opts.shopContext ?? getShopAttribution();
}
