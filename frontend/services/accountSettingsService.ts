import apiClient, { type ApiResponse } from './api';
import { getApiBaseUrl } from '../lib/apiBaseUrl';
import { getAuthToken } from '../lib/authStorage';

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

class AccountSettingsService {
  exportData(): Promise<Response> {
    const token = getAuthToken();
    const base = getApiBaseUrl();
    return fetch(`${base}/api/settings/account/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  deleteAccount(data: { currentPassword?: string; confirmDelete?: 'DELETE' }) {
    return apiClient.request<{ message: string }>('/api/settings/account', {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  }

  requestEmailChange(newEmail: string, currentPassword: string) {
    return apiClient.post<{ message: string }>('/api/settings/account/email/request', {
      newEmail,
      currentPassword,
    });
  }

  confirmEmailChange(code: string) {
    return apiClient.post<{ message: string; user: { id: string; email: string } }>(
      '/api/settings/account/email/confirm',
      { code },
    );
  }

  get2faStatus() {
    return apiClient.get<{ enabled: boolean }>('/api/settings/account/2fa/status');
  }

  setup2fa() {
    return apiClient.post<TwoFactorSetup>('/api/settings/account/2fa/setup', {});
  }

  enable2fa(token: string) {
    return apiClient.post<{ message: string; enabled: boolean }>(
      '/api/settings/account/2fa/enable',
      { token },
    );
  }

  disable2fa(token: string, currentPassword: string) {
    return apiClient.post<{ message: string; enabled: boolean }>(
      '/api/settings/account/2fa/disable',
      { token, currentPassword },
    );
  }

  updatePhone(phone: string) {
    return apiClient.patch<{ message: string; phone: string }>(
      '/api/settings/account/phone',
      { phone },
    );
  }
}

export const accountSettingsService = new AccountSettingsService();
export default accountSettingsService;
