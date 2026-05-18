/**
 * Authentication Service
 * Handles all authentication operations with backend
 */

import apiClient, { ApiResponse } from './api';
import type { User, UserRole } from '../types';

export interface RegisterData {
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface VerifyEmailData {
  email: string;
  code: string;
}

export interface AuthResponse {
  token?: string;
  user: User;
  requiresVerification?: boolean;
  requiresTwoFactor?: boolean;
  tempToken?: string;
}

export interface ProfileData {
  displayName?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  gender?: string;
  height?: number;
  weight?: number;
  fitnessGoal?: string;
  fitnessLevel?: string;
  medicalNotes?: string;
}

class AuthService {
  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/api/auth/register', data);

    if (response.data?.token) {
      localStorage.setItem('taqwin_token', response.data.token);
      localStorage.setItem('taqwin_user', JSON.stringify(response.data.user));
    }

    return response;
  }

  /**
   * Login with email and password
   */
  async login(data: LoginData): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/api/auth/login', data);

    if (response.data?.token && !response.data.requiresTwoFactor) {
      localStorage.setItem('taqwin_token', response.data.token);
      localStorage.setItem('taqwin_user', JSON.stringify(response.data.user));
    }

    return response;
  }

  async verify2faLogin(tempToken: string, code: string): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/api/auth/2fa/verify', {
      tempToken,
      code,
    });

    if (response.data?.token) {
      localStorage.setItem('taqwin_token', response.data.token);
      localStorage.setItem('taqwin_user', JSON.stringify(response.data.user));
    }

    return response;
  }

  /**
   * Verify email with code
   */
  async verifyEmail(data: VerifyEmailData): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/api/auth/verify-email', data);
    
    if (response.data?.token) {
      localStorage.setItem('taqwin_token', response.data.token);
      localStorage.setItem('taqwin_user', JSON.stringify(response.data.user));
    }
    
    return response;
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode(email: string): Promise<ApiResponse> {
    return apiClient.post('/api/auth/resend-verification', { email });
  }

  /**
   * Request a password reset email
   */
  async forgotPassword(email: string): Promise<ApiResponse> {
    return apiClient.post('/api/auth/forgot-password', { email });
  }

  /**
   * Submit a new password using a reset token
   */
  async resetPassword(token: string, password: string): Promise<ApiResponse> {
    return apiClient.post('/api/auth/reset-password', { token, password });
  }

  /**
   * Verify the signed-in user's current password (step 1 of change flow)
   */
  async verifyPassword(currentPassword: string): Promise<ApiResponse<{ ok: boolean }>> {
    return apiClient.post<{ ok: boolean }>('/api/auth/verify-password', { currentPassword });
  }

  /**
   * Change password while signed in (requires current password)
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<{ message: string }>('/api/auth/change-password', {
      currentPassword,
      newPassword,
    });
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    return apiClient.get<User>('/api/auth/me');
  }

  /**
   * Logout
   */
  logout(): void {
    localStorage.removeItem('taqwin_token');
    localStorage.removeItem('taqwin_user');
  }

  /**
   * Get stored token
   */
  getToken(): string | null {
    return localStorage.getItem('taqwin_token');
  }

  /**
   * Update cached user (e.g. after profile / onboarding save)
   */
  syncStoredUser(user: User): void {
    localStorage.setItem('taqwin_user', JSON.stringify(user));
  }

  /**
   * Get stored user
   */
  getStoredUser(): User | null {
    const userStr = localStorage.getItem('taqwin_user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Handle OAuth callback (redirect from backend)
   */
  handleOAuthCallback(token: string, userData: User): void {
    localStorage.setItem('taqwin_token', token);
    localStorage.setItem('taqwin_user', JSON.stringify(userData));
  }
}

export const authService = new AuthService();
export default authService;
