/**
 * API Client Configuration
 * Connects to backend-node Express server
 */

import { getApiBaseUrl } from '../lib/apiBaseUrl';
import { isAuthSessionError, isTransientApiError, sanitizeApiError, sleepMs } from '../lib/apiTransientError';
import { getAuthToken } from '../lib/authStorage';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  missing?: string[];
  message?: string;
  code?: string;
  conflict?: { name?: string; startTime?: string; endTime?: string };
  /** Present on some auth error responses (e.g. login before email verified) */
  requiresVerification?: boolean;
  email?: string;
  /** Local dev only — when Gmail is not configured */
  devCode?: string;
  stepUpEligible?: boolean;
  stepUpRequired?: boolean;
  stepUpPhrase?: string | null;
  stepUpMethods?: Array<'phrase' | 'password'>;
  stepUpIdleMs?: number;
  pendingCreatedAt?: string;
  stepUpStaleAt?: string;
}

class ApiClient {
  private resolveBaseURL(): string {
    return getApiBaseUrl();
  }

  private getAuthHeaders(): HeadersInit {
    const token = getAuthToken();
    const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('taqwin_lang') : null;
    const acceptLanguage = storedLang === 'en' || storedLang === 'ar' ? storedLang : undefined;
    return {
      'Content-Type': 'application/json',
      ...(acceptLanguage && { 'Accept-Language': acceptLanguage }),
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit & { timeoutMs?: number } = {},
  ): Promise<ApiResponse<T>> {
    const { timeoutMs = 20000, signal: externalSignal, ...fetchOptions } = options;
    const maxAttempts = 4;
    const retryBaseMs = 1200;
    let lastResult: ApiResponse<T> = { error: 'Network error' };

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onExternalAbort = () => controller.abort();
      if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', onExternalAbort);
      }

      try {
        const response = await fetch(`${this.resolveBaseURL()}${endpoint}`, {
          ...fetchOptions,
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            ...this.getAuthHeaders(),
            ...fetchOptions.headers,
          },
        });

        let payload: unknown = null;
        try {
          payload = await response.json();
        } catch {
          /* non-JSON error body (e.g. proxy HTML) */
        }

        const data =
          payload !== null && typeof payload === 'object' && !Array.isArray(payload)
            ? (payload as Record<string, unknown>)
            : {};

        if (!response.ok) {
          const hasBody =
            typeof data.error === 'string' ||
            typeof data.message === 'string' ||
            (payload !== null &&
              (Array.isArray(payload) ? payload.length > 0 : Object.keys(data).length > 0));
          const unreachable =
            !hasBody && (response.status === 500 || response.status === 502 || response.status === 503);
          const transientHint =
            'Cannot reach the API. The server may be restarting — wait a moment and try again.';
          const validationDetails =
            Array.isArray(data.details)
              ? data.details
                  .map((entry) => {
                    if (!entry || typeof entry !== 'object') return '';
                    const path = typeof entry.path === 'string' && entry.path ? entry.path : '';
                    const message = typeof entry.message === 'string' ? entry.message : '';
                    return path ? `${path}: ${message}` : message;
                  })
                  .filter(Boolean)
                  .join('; ')
              : '';
          const baseError =
            (typeof data.error === 'string' && data.error) ||
            (typeof data.message === 'string' && data.message) ||
            (unreachable ? transientHint : `Request failed (${response.status})`);
          const error = sanitizeApiError(
            validationDetails && baseError === 'Validation failed'
              ? `${baseError}: ${validationDetails}`
              : baseError,
          );

          if (isAuthSessionError(error) && getAuthToken()) {
            void import('../store/useAuthStore').then(({ useAuthStore }) => {
              useAuthStore.getState().logout();
            });
          }

          lastResult = {
            error,
            missing: Array.isArray(data.missing) ? (data.missing as string[]) : undefined,
            requiresVerification: data.requiresVerification === true,
            email: typeof data.email === 'string' ? data.email : undefined,
            devCode: typeof data.devCode === 'string' ? data.devCode : undefined,
            code: typeof data.code === 'string' ? data.code : undefined,
            stepUpEligible: data.stepUpEligible === true,
            stepUpRequired: data.stepUpRequired === true,
            stepUpPhrase: typeof data.stepUpPhrase === 'string' ? data.stepUpPhrase : null,
            stepUpMethods: Array.isArray(data.stepUpMethods) ? data.stepUpMethods : undefined,
            stepUpIdleMs: typeof data.stepUpIdleMs === 'number' ? data.stepUpIdleMs : undefined,
            pendingCreatedAt: typeof data.pendingCreatedAt === 'string' ? data.pendingCreatedAt : undefined,
            stepUpStaleAt: typeof data.stepUpStaleAt === 'string' ? data.stepUpStaleAt : undefined,
          };
        } else {
          lastResult = { data: payload as T };
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          lastResult = {
            error:
              externalSignal?.aborted && !controller.signal.aborted
                ? 'aborted'
                : 'Request timed out. Check your connection and try again.',
          };
        } else {
          console.error('API request failed:', error);
          const msg = error instanceof Error ? error.message : 'Network error';
          const friendly =
            msg === 'Failed to fetch'
              ? 'Cannot reach the API. The server may be restarting — wait a moment and try again.'
              : msg;
          lastResult = { error: friendly };
        }
      } finally {
        clearTimeout(timer);
        if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
      }

      if (!lastResult.error || !isTransientApiError(lastResult.error) || attempt === maxAttempts - 1) {
        return lastResult;
      }
      await sleepMs(retryBaseMs * (attempt + 1));
    }

    return lastResult;
  }

  async get<T = any>(
    endpoint: string,
    init?: RequestInit & { timeoutMs?: number },
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', ...init });
  }

  async post<T = any>(
    endpoint: string,
    body: any,
    options: { timeoutMs?: number } = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    });
  }

  async put<T = any>(
    endpoint: string,
    body: any
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async patch<T = any>(
    endpoint: string,
    body: any
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
