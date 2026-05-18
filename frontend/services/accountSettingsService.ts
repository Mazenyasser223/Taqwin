import apiClient, { type ApiResponse } from './api';

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

class AccountSettingsService {
  exportData(): Promise<Response> {
    const token = localStorage.getItem('taqwin_token');
    const base = import.meta.env.VITE_API_URL || 'http://localhost:4000';
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
}

export const accountSettingsService = new AccountSettingsService();
export default accountSettingsService;
