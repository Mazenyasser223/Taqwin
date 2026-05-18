/**
 * API Client Configuration
 * Connects to backend-node Express server
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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
    const token = localStorage.getItem('taqwin_token');
    return {
      'Content-Type': 'application/json',
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
        return {
          error:
            (typeof data.error === 'string' && data.error) ||
            (typeof data.message === 'string' && data.message) ||
            `Request failed (${response.status})`,
          requiresVerification: data.requiresVerification === true,
          email: typeof data.email === 'string' ? data.email : undefined,
          devCode: typeof data.devCode === 'string' ? data.devCode : undefined,
        };
      }

      return { data: data as T };
    } catch (error) {
      console.error('API request failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
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
