import apiClient, { ApiResponse } from './api';
import type { Gym, GymMembership, GymCheckIn } from '../types';

class GymService {
  async getGyms(): Promise<ApiResponse<Gym[]>> {
    return apiClient.get<Gym[]>('/api/gyms');
  }

  async getGym(id: string): Promise<ApiResponse<Gym>> {
    return apiClient.get<Gym>(`/api/gyms/${id}`);
  }

  async checkIn(gymId: string): Promise<ApiResponse<GymCheckIn>> {
    return apiClient.post<GymCheckIn>(`/api/gyms/${gymId}/check-in`, {});
  }

  async getMyMemberships(): Promise<ApiResponse<GymMembership[]>> {
    return apiClient.get<GymMembership[]>('/api/gyms/memberships/me');
  }

  async getCheckInHistory(): Promise<ApiResponse<GymCheckIn[]>> {
    return apiClient.get<GymCheckIn[]>('/api/gyms/check-ins/me');
  }

  // Gym owner endpoints
  async createGym(data: Partial<Gym>): Promise<ApiResponse<Gym>> {
    return apiClient.post<Gym>('/api/gyms', data);
  }

  async updateGym(id: string, data: Partial<Gym>): Promise<ApiResponse<Gym>> {
    return apiClient.patch<Gym>(`/api/gyms/${id}`, data);
  }

  async getMyGymMembers(gymId: string): Promise<ApiResponse<GymMembership[]>> {
    return apiClient.get<GymMembership[]>(`/api/gyms/${gymId}/members`);
  }
}

export const gymService = new GymService();
export default gymService;
