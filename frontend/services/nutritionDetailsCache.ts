import type { FdcFoodDetails } from '../types';
import type { ApiResponse } from './api';

const TTL_MS = Number(import.meta.env.VITE_NUTRITION_DETAILS_CACHE_MS) || 15 * 60 * 1000;
const MAX_ENTRIES = 120;

type Entry = { at: number; data: FdcFoodDetails };

const store = new Map<number, Entry>();
const inflight = new Map<number, Promise<ApiResponse<FdcFoodDetails>>>();

function prune() {
  if (store.size <= MAX_ENTRIES) return;
  const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
  if (oldest != null) store.delete(oldest);
}

export function peekFoodDetails(webtebId: number): FdcFoodDetails | null {
  const hit = store.get(webtebId);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(webtebId);
    return null;
  }
  return hit.data;
}

export function setFoodDetailsCached(webtebId: number, data: FdcFoodDetails): void {
  store.set(webtebId, { at: Date.now(), data });
  prune();
}

export function fetchFoodDetailsDeduped(
  webtebId: number,
  fetcher: () => Promise<ApiResponse<FdcFoodDetails>>
): Promise<ApiResponse<FdcFoodDetails>> {
  const cached = peekFoodDetails(webtebId);
  if (cached) return Promise.resolve({ data: cached });

  const pending = inflight.get(webtebId);
  if (pending) return pending;

  const promise = fetcher().then((res) => {
    inflight.delete(webtebId);
    if (res.data) setFoodDetailsCached(webtebId, res.data);
    return res;
  });
  inflight.set(webtebId, promise);
  return promise;
}

export function prefetchFoodDetails(webtebId: number, fetcher: () => Promise<ApiResponse<FdcFoodDetails>>): void {
  if (!webtebId || peekFoodDetails(webtebId) || inflight.has(webtebId)) return;
  void fetchFoodDetailsDeduped(webtebId, fetcher);
}
