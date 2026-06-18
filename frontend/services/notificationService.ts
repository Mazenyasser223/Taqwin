import apiClient, { ApiResponse } from './api';
import type { Notification, NotificationListResponse } from '../types';

export type NotificationFilter =
  | 'ALL'
  | 'UNREAD'
  | 'SOCIAL'
  | 'WORKOUT'
  | 'AI'
  | 'SHOP'
  | 'SUPPORT'
  | 'GYM'
  | 'SYSTEM';

class NotificationService {
  async list(opts?: { cursor?: string; limit?: number; category?: NotificationFilter }): Promise<ApiResponse<NotificationListResponse>> {
    const params = new URLSearchParams();
    if (opts?.cursor) params.set('cursor', opts.cursor);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.category && opts.category !== 'ALL') params.set('category', opts.category);
    const qs = params.toString();
    return apiClient.get<NotificationListResponse>(`/api/notifications${qs ? `?${qs}` : ''}`);
  }

  async markSeen(): Promise<ApiResponse<{ updated: number; seenAt: string }>> {
    return apiClient.post<{ updated: number; seenAt: string }>('/api/notifications/seen', {});
  }

  async markRead(id: string): Promise<ApiResponse<Notification>> {
    return apiClient.post<Notification>(`/api/notifications/${id}/read`, {});
  }

  async markAllRead(): Promise<ApiResponse<{ updated: number; readAt: string }>> {
    return apiClient.post<{ updated: number; readAt: string }>('/api/notifications/read-all', {});
  }

  async runAction(id: string, action: string): Promise<ApiResponse<{ ok: boolean; snoozedUntil?: string }>> {
    return apiClient.post<{ ok: boolean; snoozedUntil?: string }>(`/api/notifications/${id}/action`, { action });
  }

  async trackEvent(id: string, event: string, metadata?: Record<string, unknown>): Promise<ApiResponse<{ ok: true }>> {
    return apiClient.post<{ ok: true }>(`/api/notifications/${id}/event`, { event, metadata });
  }

  async remove(id: string): Promise<ApiResponse<{ ok: true }>> {
    return apiClient.delete<{ ok: true }>(`/api/notifications/${id}`);
  }
}

export const notificationService = new NotificationService();
export default notificationService;
