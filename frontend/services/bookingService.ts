import apiClient, { ApiResponse } from './api';
import type { TrainerBooking } from '../types';

export interface CreateBookingData {
  trainerId: string;
  scheduledAt: string; // ISO datetime
  notes?: string;
}

class BookingService {
  async getTrainers(): Promise<ApiResponse<any[]>> {
    return apiClient.get('/api/trainers');
  }

  async createBooking(data: CreateBookingData): Promise<ApiResponse<TrainerBooking>> {
    return apiClient.post<TrainerBooking>('/api/bookings', data);
  }

  async getMyBookings(): Promise<ApiResponse<TrainerBooking[]>> {
    return apiClient.get<TrainerBooking[]>('/api/bookings/me');
  }

  async getTrainerBookings(): Promise<ApiResponse<TrainerBooking[]>> {
    return apiClient.get<TrainerBooking[]>('/api/bookings/trainer');
  }

  async updateBookingStatus(
    id: string,
    status: TrainerBooking['status']
  ): Promise<ApiResponse<TrainerBooking>> {
    return apiClient.patch<TrainerBooking>(`/api/bookings/${id}`, { status });
  }

  async cancelBooking(id: string): Promise<ApiResponse<TrainerBooking>> {
    return this.updateBookingStatus(id, 'cancelled');
  }
}

export const bookingService = new BookingService();
export default bookingService;
