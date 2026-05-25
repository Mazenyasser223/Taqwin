/**
 * Lightweight GET cache: stale-while-revalidate + in-flight dedupe.
 */

type CacheEntry<T> = {
  data: T;
  at: number;
};

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export function peekGetCache<T>(key: string, ttlMs: number): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) return null;
  return hit.data as T;
}

export function setGetCache<T>(key: string, data: T): void {
  store.set(key, { data, at: Date.now() });
}

export async function cachedGet<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const fresh = peekGetCache<T>(key, ttlMs);
  if (fresh != null) return fresh;

  const stale = store.get(key)?.data as T | undefined;
  const pending = inflight.get(key) as Promise<T> | undefined;

  if (pending) {
    try {
      return await pending;
    } catch {
      if (stale != null) return stale;
      throw new Error('Request failed');
    }
  }

  const promise = fetcher()
    .then((data) => {
      setGetCache(key, data);
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);

  try {
    return await promise;
  } catch (err) {
    if (stale != null) return stale;
    throw err;
  }
}

export function invalidateGetCache(key: string): void {
  store.delete(key);
}

/** Fire-and-forget refresh when serving stale cache. */
export function revalidateGet<T>(key: string, fetcher: () => Promise<T>, onData?: (data: T) => void): void {
  if (inflight.has(key)) return;
  const promise = fetcher()
    .then((data) => {
      setGetCache(key, data);
      onData?.(data);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
}
