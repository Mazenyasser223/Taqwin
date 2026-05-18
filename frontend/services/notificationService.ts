import apiClient, { ApiResponse } from './api';
import type { Notification } from '../types';

class NotificationService {
  async list(): Promise<ApiResponse<Notification[]>> {
    return apiClient.get<Notification[]>('/api/notifications');
  }

  async markRead(id: string): Promise<ApiResponse<Notification>> {
    return apiClient.post<Notification>(`/api/notifications/${id}/read`, {});
  }

  async markAllRead(): Promise<ApiResponse<{ updated: number }>> {
    return apiClient.post<{ updated: number }>('/api/notifications/read-all', {});
  }

  async remove(id: string): Promise<ApiResponse<{ ok: true }>> {
    return apiClient.delete<{ ok: true }>(`/api/notifications/${id}`);
  }
}

export const notificationService = new NotificationService();
export default notificationService;
