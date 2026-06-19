/** Auth/session failures that require signing in again — retrying the same request will not help. */
export function isAuthSessionError(message: string | undefined): boolean {
  if (!message) return false;
  return /invalid or expired token|session expired|authentication required/i.test(message);
}

/** Errors that often clear after a backend dev restart or brief network blip. */
export function isTransientApiError(message: string | undefined): boolean {
  if (!message) return false;
  return /Cannot reach the API|Network error|Failed to fetch|timed out|Request timed out|Request failed|Database is busy|temporarily unavailable|ECONNRESET|502|503/i.test(
    message,
  );
}

export function isApiUnreachableMessage(message: string | undefined): boolean {
  return isTransientApiError(message);
}

export function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function withTransientRetry<T>(
  fetcher: () => Promise<T>,
  opts?: { attempts?: number; baseDelayMs?: number; onRetry?: (attempt: number) => void },
): Promise<T> {
  const attempts = opts?.attempts ?? 4;
  const baseDelayMs = opts?.baseDelayMs ?? 1500;
  let last: T | undefined;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await fetcher();
    const error =
      last != null &&
      typeof last === 'object' &&
      'error' in last &&
      typeof (last as { error?: string }).error === 'string'
        ? (last as { error: string }).error
        : undefined;

    if (!error || !isTransientApiError(error) || attempt === attempts - 1) {
      return last;
    }

    opts?.onRetry?.(attempt + 1);
    await sleepMs(baseDelayMs * (attempt + 1));
  }

  return last as T;
}
