import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiResponse } from '../services/api';

const TTL_MS = 30_000;
const store = new Map<string, { data: unknown; expires: number }>();

export function getAdminShopCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.expires) return null;
  return entry.data as T;
}

export function setAdminShopCache(key: string, data: unknown) {
  store.set(key, { data, expires: Date.now() + TTL_MS });
}

export function invalidateAdminShopCache(prefix?: string) {
  for (const key of store.keys()) {
    if (!prefix || key.startsWith(prefix)) store.delete(key);
  }
}

export function useAdminShopQuery<T>(
  key: string,
  fetcher: () => Promise<ApiResponse<T>>,
  enabled = true,
) {
  const [data, setData] = useState<T | null>(() => getAdminShopCache<T>(key));
  const [loading, setLoading] = useState(enabled && !getAdminShopCache<T>(key));
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async (skipCache = false) => {
    if (!skipCache) {
      const cached = getAdminShopCache<T>(key);
      if (cached) {
        setData(cached);
        setLoading(false);
        return cached;
      }
    }
    setLoading(true);
    setError(null);
    const res = await fetcherRef.current();
    if (res.error) {
      setError(res.error);
      setLoading(false);
      return null;
    }
    const next = res.data ?? null;
    if (next !== null && next !== undefined) setAdminShopCache(key, next);
    setData(next);
    setLoading(false);
    return next;
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    void reload();
  }, [enabled, reload, key]);

  return { data, loading, error, reload, setData };
}

export type AdminShopQueryResult<T> = ReturnType<typeof useAdminShopQuery<T>>;
