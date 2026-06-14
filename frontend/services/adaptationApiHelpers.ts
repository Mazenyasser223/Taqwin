import { type ApiResponse } from './api';

export function unwrapApiData<T>(res: ApiResponse<T>, fallbackMessage: string): T {
  if (res.error) {
    const detail =
      res.missing?.length
        ? `${res.error} (missing: ${res.missing.join(', ')})`
        : res.error;
    throw new Error(detail);
  }
  if (res.data == null) throw new Error(fallbackMessage);
  return res.data;
}
