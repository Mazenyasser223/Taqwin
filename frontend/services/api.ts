/**
 * API Client Configuration
 * Connects to backend-node Express server
 */

import { getApiBaseUrl } from '../lib/apiBaseUrl';
import { getAuthToken } from '../lib/authStorage';

const API_BASE_URL = getApiBaseUrl();

const DB_BUSY_RE = /database is (busy|temporarily unavailable)/i;
const DB_BUSY_RETRIES = 3;
const DB_BUSY_DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isDbBusyError(status: number, message: string | undefined): boolean {
  return status === 503 && Boolean(message && DB_BUSY_RE.test(message));
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  conflict?: { name?: string; startTime?: string; endTime?: string };
  /** Present on some auth error responses (e.g. login before email verified) */
  requiresVerification?: boolean;
  email?: string;
  /** Local dev only — when Gmail is not configured */
  devCode?: string;
}

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
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

  private async requestOnce<T = any>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
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
      const errorMessage =
        (typeof data.error === 'string' && data.error) ||
        (typeof data.message === 'string' && data.message) ||
        (unreachable
          ? 'Cannot reach the API. Make sure the backend is running (backend-node: npm run dev), then try again.'
          : `Request failed (${response.status})`);
      return {
        error: errorMessage,
        code: typeof data.code === 'string' ? data.code : undefined,
        conflict:
          data.conflict && typeof data.conflict === 'object' && !Array.isArray(data.conflict)
            ? (data.conflict as ApiResponse['conflict'])
            : undefined,
        requiresVerification: data.requiresVerification === true,
        email: typeof data.email === 'string' ? data.email : undefined,
        devCode: typeof data.devCode === 'string' ? data.devCode : undefined,
        _httpStatus: response.status,
      };
    }

    return { data: payload as T };
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const method = (options.method || 'GET').toUpperCase();
    const canRetry = method === 'GET' || method === 'HEAD';

    try {
      let last: ApiResponse<T> & { _httpStatus?: number } | null = null;
      for (let attempt = 0; attempt < (canRetry ? DB_BUSY_RETRIES : 1); attempt += 1) {
        if (attempt > 0) await sleep(DB_BUSY_DELAY_MS * attempt);
        last = await this.requestOnce<T>(endpoint, options);
        if (!last.error || !isDbBusyError(last._httpStatus ?? 0, last.error)) {
          const { _httpStatus: _, ...clean } = last;
          return clean;
        }
      }
      const { _httpStatus: _, ...clean } = last ?? { error: 'Request failed' };
      return clean;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { error: 'aborted' };
      }
      console.error('API request failed:', error);
      const msg = error instanceof Error ? error.message : 'Network error';
      const friendly =
        msg === 'Failed to fetch'
          ? 'Cannot reach the API. Run the backend (backend-node: npm run dev) and reload the page.'
          : msg;
      return { error: friendly };
    }
  }

  async get<T = any>(endpoint: string, init?: RequestInit): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', ...init });
  }

  async post<T = any>(
    endpoint: string,
    body: any
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
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

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;
