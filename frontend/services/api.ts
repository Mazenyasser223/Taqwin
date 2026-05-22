/**
 * API Client Configuration
 * Connects to backend-node Express server
 */

import { getApiBaseUrl } from '../lib/apiBaseUrl';
import { getAuthToken } from '../lib/authStorage';

const API_BASE_URL = getApiBaseUrl();

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
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

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          ...this.getAuthHeaders(),
          ...options.headers,
        },
      });

      let data: Record<string, unknown> = {};
      try {
        data = (await response.json()) as Record<string, unknown>;
      } catch {
        /* non-JSON error body (e.g. proxy HTML) */
      }

      if (!response.ok) {
        const hasBody =
          typeof data.error === 'string' ||
          typeof data.message === 'string' ||
          Object.keys(data).length > 0;
        const unreachable =
          !hasBody && (response.status === 500 || response.status === 502 || response.status === 503);
        return {
          error:
            (typeof data.error === 'string' && data.error) ||
            (typeof data.message === 'string' && data.message) ||
            (unreachable
              ? 'Cannot reach the API. Make sure the backend is running (backend-node: npm run dev), then try again.'
              : `Request failed (${response.status})`),
          requiresVerification: data.requiresVerification === true,
          email: typeof data.email === 'string' ? data.email : undefined,
          devCode: typeof data.devCode === 'string' ? data.devCode : undefined,
        };
      }

      return { data: data as T };
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
