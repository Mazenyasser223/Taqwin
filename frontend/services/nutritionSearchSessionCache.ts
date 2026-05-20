import type { FdcSearchResult } from '../types';
import type { ApiResponse } from './api';
import type { WebtebSearchParams } from './nutritionService';

const TTL_MS = Number(import.meta.env.VITE_FDC_SESSION_CACHE_MS) || 10 * 60 * 1000;
const MAX_ENTRIES = 80;

type Entry = { at: number; res: ApiResponse<FdcSearchResult> };

const store = new Map<string, Entry>();

function cacheKey(params: WebtebSearchParams, path: string): string {
  return `${path}:${JSON.stringify(params)}`;
}

function prune() {
  if (store.size <= MAX_ENTRIES) return;
  const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
  if (oldest) store.delete(oldest);
}

export function getNutritionSearchCached(
  params: WebtebSearchParams,
  path: string
): ApiResponse<FdcSearchResult> | null {
  const key = cacheKey(params, path);
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    store.delete(key);
    return null;
  }
  return hit.res;
}

export function setNutritionSearchCached(
  params: WebtebSearchParams,
  path: string,
  res: ApiResponse<FdcSearchResult>
): void {
  if (res.error || !res.data) return;
  const key = cacheKey(params, path);
  store.set(key, { at: Date.now(), res });
  prune();
}

/** Instant UI: return last successful search for these params (ignores AbortSignal). */
export function peekNutritionSearchCached(
  params: WebtebSearchParams,
  path: string
): ApiResponse<FdcSearchResult> | null {
  return getNutritionSearchCached(params, path);
}
