/**
 * Authentication Service
 * Handles all authentication operations with backend
 */

import apiClient, { ApiResponse } from './api';
import {
  clearAuthSession,
  getAuthToken,
  getAuthUser,
  persistAuthSession,
  syncAuthUser,
} from '../lib/authStorage';
import type { User, UserRole } from '../types';

export interface RegisterData {
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface VerifyEmailData {
  email: string;
  code: string;
}

export type PasswordResetChannel = 'email' | 'sms';

export interface ForgotPasswordParams {
  channel?: PasswordResetChannel;
  email?: string;
  phone?: string;
}

export interface ResetPasswordParams {
  channel?: PasswordResetChannel;
  email?: string;
  phone?: string;
  code: string;
  password: string;
}

export interface AuthResponse {
  token?: string;
  user?: User;
  requiresVerification?: boolean;
  requiresTwoFactor?: boolean;
  tempToken?: string;
  devVerificationCode?: string;
  email?: string;
  message?: string;
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

function saveSession(
  token: string | undefined,
  user: User | undefined,
  rememberMe = true,
): void {
  if (token && user) {
    persistAuthSession(token, user, rememberMe);
  }
}

export type CheckEmailCode = 'EMAIL_ALREADY_REGISTERED' | 'GOOGLE_SIGNUP_INCOMPLETE';

export interface CheckEmailResponse {
  available: boolean;
  code?: CheckEmailCode;
}

class AuthService {
  async checkEmailAvailable(email: string): Promise<ApiResponse<CheckEmailResponse>> {
    return apiClient.post<CheckEmailResponse>('/api/auth/check-email', {
      email: email.trim().toLowerCase(),
    });
  }

  async register(data: RegisterData): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/api/auth/register', data);
    if (response.data?.token && response.data.user) {
      saveSession(response.data.token, response.data.user, true);
    }
    return response;
  }

  async login(data: LoginData): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/api/auth/login', {
      email: data.email,
      password: data.password,
      rememberMe: Boolean(data.rememberMe),
    });

    if (response.data?.token && response.data.user && !response.data.requiresTwoFactor) {
      saveSession(response.data.token, response.data.user, Boolean(data.rememberMe));
    }

    return response;
  }

  async verify2faLogin(
    tempToken: string,
    code: string,
    rememberMe = false,
  ): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/api/auth/2fa/verify', {
      tempToken,
      code,
    });

    if (response.data?.token && response.data.user) {
      saveSession(response.data.token, response.data.user, rememberMe);
    }

    return response;
  }

  async verifyEmail(data: VerifyEmailData): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/api/auth/verify-email', data);
    if (response.data?.token && response.data.user) {
      saveSession(response.data.token, response.data.user, true);
    }
    return response;
  }

  async resendVerificationCode(email: string): Promise<ApiResponse> {
    return apiClient.post('/api/auth/resend-verification', { email });
  }

  async forgotPassword(params: ForgotPasswordParams | string): Promise<ApiResponse> {
    const body =
      typeof params === 'string'
        ? { channel: 'email' as const, email: params }
        : {
            channel: params.channel ?? 'email',
            ...(params.channel === 'sms' ? { phone: params.phone } : { email: params.email }),
          };
    return apiClient.post('/api/auth/forgot-password', body);
  }

  async resetPassword(params: ResetPasswordParams): Promise<ApiResponse> {
    const { channel = 'email', email, phone, code, password } = params;
    return apiClient.post('/api/auth/reset-password', {
      channel,
      ...(channel === 'sms' ? { phone } : { email }),
      code,
      password,
    });
  }

  async verifyPassword(currentPassword: string): Promise<ApiResponse<{ ok: boolean }>> {
    return apiClient.post<{ ok: boolean }>('/api/auth/verify-password', { currentPassword });
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<{ message: string }>('/api/auth/change-password', {
      currentPassword,
      newPassword,
    });
  }

  async completeSignupRole(role: UserRole): Promise<ApiResponse<{ user: User }>> {
    const response = await apiClient.post<{ user: User }>('/api/auth/signup-role', { role });
    if (response.data?.user) {
      syncAuthUser(response.data.user);
    }
    return response;
  }

  async setInitialPassword(password: string): Promise<ApiResponse<{ message: string; user: User }>> {
    const response = await apiClient.post<{ message: string; user: User }>(
      '/api/auth/set-initial-password',
      { password },
    );
    if (response.data?.user) {
      syncAuthUser(response.data.user);
    }
    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return apiClient.get<User>('/api/auth/me');
  }

  logout(): void {
    clearAuthSession();
  }

  getToken(): string | null {
    return getAuthToken();
  }

  syncStoredUser(user: User): void {
    syncAuthUser(user);
  }

  getStoredUser(): User | null {
    return getAuthUser();
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  handleOAuthCallback(token: string, userData: User, rememberMe = true): void {
    saveSession(token, userData, rememberMe);
  }
}

export const authService = new AuthService();
export default authService;
