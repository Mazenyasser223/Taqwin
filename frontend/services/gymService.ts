import apiClient, { ApiResponse } from './api';
import { getApiBaseUrl } from '../lib/apiBaseUrl';
import { getAuthToken } from '../lib/authStorage';
import type { Gym, GymMembership, GymCheckIn, GymSubscriptionPlan, GymEquipment, GymStaff, GymStaffPayout, GymStaffPayResult, GymStaffRole, WorkingHourSlot, ReceptionMemberDetail, ReceptionMemberVisit, ReceptionMemberVisitStats, ReceptionPresentMember, ReceptionPresentCounts, GymClass, GymClassBooking, GymBasicSession, GymBasicSessionBooking } from '../types';

class GymService {
  async getGyms(): Promise<ApiResponse<Gym[]>> {
    return apiClient.get<Gym[]>('/api/gyms');
  }

  async getGym(id: string): Promise<ApiResponse<Gym>> {
    return apiClient.get<Gym>(`/api/gyms/${id}`);
  }

  async submitGymReview(
    gymId: string,
    data: { rating: number; body: string },
  ): Promise<ApiResponse<{ id: string; rating: number; body: string; helpfulCount: number; createdAt: string }>> {
    return apiClient.post(`/api/gyms/${gymId}/reviews`, data);
  }

  async getGymReviews(
    gymId: string,
  ): Promise<ApiResponse<Array<{ id: string; rating: number; body: string; helpfulCount: number; createdAt: string }>>> {
    return apiClient.get(`/api/gyms/${gymId}/reviews`);
  }

  async getGymReviewSummary(
    gymId: string,
    refresh = false,
  ): Promise<
    ApiResponse<{
      reviewCount: number;
      positive: number;
      neutral: number;
      negative: number;
      keywords: string[];
      source: 'openai' | 'stars' | 'none';
      analyzedAt: string;
    }>
  > {
    const qs = refresh ? '?refresh=true' : '';
    return apiClient.get(`/api/gyms/${gymId}/reviews/summary${qs}`);
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

  async getReceptionPresent(gymId: string): Promise<
    ApiResponse<{ counts: ReceptionPresentCounts; members: ReceptionPresentMember[] }>
  > {
    return apiClient.get(`/api/gyms/${gymId}/reception/present`);
  }

  async getReceptionMembers(gymId: string): Promise<ApiResponse<{ members: ReceptionMemberDetail[] }>> {
    return apiClient.get(`/api/gyms/${gymId}/reception/members`);
  }

  async searchReceptionMembers(
    gymId: string,
    q: string,
  ): Promise<ApiResponse<{ members: ReceptionMemberDetail[] }>> {
    return apiClient.get(`/api/gyms/${gymId}/reception/search?q=${encodeURIComponent(q)}`);
  }

  async getReceptionMember(gymId: string, userId: string): Promise<ApiResponse<ReceptionMemberDetail>> {
    return apiClient.get(`/api/gyms/${gymId}/reception/members/${userId}`);
  }

  async getReceptionMemberVisits(
    gymId: string,
    userId: string,
  ): Promise<ApiResponse<{ visits: ReceptionMemberVisit[]; stats: ReceptionMemberVisitStats }>> {
    return apiClient.get(`/api/gyms/${gymId}/reception/members/${userId}/visits`);
  }

  async receptionCheckIn(gymId: string, userId: string): Promise<ApiResponse<{ visitId: string; checkedInAt: string }>> {
    return apiClient.post(`/api/gyms/${gymId}/reception/check-in`, { userId });
  }

  async receptionCheckOut(gymId: string, userId: string): Promise<ApiResponse<{ visitId: string; checkedOutAt: string }>> {
    return apiClient.post(`/api/gyms/${gymId}/reception/check-out`, { userId });
  }

  async addMemberByEmail(
    gymId: string,
    data: {
      email: string;
      expiresAt?: string;
      planId?: string;
      paidAmount?: number;
      paymentMethod?: 'cash' | 'card' | 'transfer' | 'online';
    },
  ): Promise<ApiResponse<GymMembership>> {
    return apiClient.post<GymMembership>(`/api/gyms/${gymId}/members`, data);
  }

  async getGymPlans(gymId: string): Promise<ApiResponse<GymSubscriptionPlan[]>> {
    return apiClient.get<GymSubscriptionPlan[]>(`/api/gyms/${gymId}/plans`);
  }

  async createGymPlan(
    gymId: string,
    data: Omit<GymSubscriptionPlan, 'id' | 'gymId' | 'isActive' | 'memberCount' | 'createdAt' | 'updatedAt'>,
  ): Promise<ApiResponse<GymSubscriptionPlan>> {
    return apiClient.post<GymSubscriptionPlan>(`/api/gyms/${gymId}/plans`, data);
  }

  async updateGymPlan(
    gymId: string,
    planId: string,
    data: Partial<GymSubscriptionPlan>,
  ): Promise<ApiResponse<GymSubscriptionPlan>> {
    return apiClient.patch<GymSubscriptionPlan>(`/api/gyms/${gymId}/plans/${planId}`, data);
  }

  async deactivateGymPlan(gymId: string, planId: string): Promise<ApiResponse<GymSubscriptionPlan>> {
    return apiClient.delete<GymSubscriptionPlan>(`/api/gyms/${gymId}/plans/${planId}`);
  }

  async registerReceptionMember(
    gymId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      address?: string;
      gender?: 'male' | 'female';
      expiresAt?: string;
      planId?: string;
      paidAmount?: number;
      paymentMethod?: 'cash' | 'card' | 'transfer' | 'online';
      avatarUrl?: string;
    },
  ): Promise<ApiResponse<{ accountCreated: boolean; member: ReceptionMemberDetail }>> {
    return apiClient.post(`/api/gyms/${gymId}/reception/register`, data);
  }

  async updateMemberMembership(
    gymId: string,
    userId: string,
    data: {
      planId?: string;
      expiresAt?: string | null;
      paidAmount?: number;
      paymentMethod?: 'cash' | 'card' | 'transfer' | 'online';
      isActive?: boolean;
    },
  ): Promise<ApiResponse<ReceptionMemberDetail>> {
    return apiClient.patch(`/api/gyms/${gymId}/reception/members/${userId}/membership`, data);
  }

  async deleteReceptionMember(
    gymId: string,
    userId: string,
  ): Promise<ApiResponse<{ ok: boolean; userId: string; userDeleted?: boolean; mode?: string }>> {
    return apiClient.delete(`/api/gyms/${gymId}/reception/members/${userId}`);
  }

  async getEquipment(gymId: string): Promise<ApiResponse<GymEquipment[]>> {
    return apiClient.get<GymEquipment[]>(`/api/gyms/${gymId}/equipment`);
  }

  async createEquipment(
    gymId: string,
    data: {
      name: string;
      nameAr?: string;
      imageUrl?: string | null;
      nextMaintenanceAt?: string | null;
      maintenanceIntervalDays?: number;
    },
  ): Promise<ApiResponse<GymEquipment>> {
    return apiClient.post<GymEquipment>(`/api/gyms/${gymId}/equipment`, data);
  }

  async updateEquipment(
    gymId: string,
    equipmentId: string,
    data: Partial<{
      name: string;
      nameAr: string | null;
      imageUrl: string | null;
      nextMaintenanceAt: string | null;
      maintenanceIntervalDays: number;
    }>,
  ): Promise<ApiResponse<GymEquipment>> {
    return apiClient.patch<GymEquipment>(`/api/gyms/${gymId}/equipment/${equipmentId}`, data);
  }

  async deleteEquipment(
    gymId: string,
    equipmentId: string,
  ): Promise<ApiResponse<{ ok: boolean; id: string }>> {
    return apiClient.delete(`/api/gyms/${gymId}/equipment/${equipmentId}`);
  }

  async markEquipmentMaintenance(gymId: string, equipmentId: string): Promise<ApiResponse<GymEquipment>> {
    return apiClient.post<GymEquipment>(`/api/gyms/${gymId}/equipment/${equipmentId}/mark-maintenance`, {});
  }

  async completeEquipmentMaintenance(gymId: string, equipmentId: string): Promise<ApiResponse<GymEquipment>> {
    return apiClient.post<GymEquipment>(`/api/gyms/${gymId}/equipment/${equipmentId}/complete-maintenance`, {});
  }

  async markEquipmentCleaning(gymId: string, equipmentId: string): Promise<ApiResponse<GymEquipment>> {
    return apiClient.post<GymEquipment>(`/api/gyms/${gymId}/equipment/${equipmentId}/mark-cleaning`, {});
  }

  async completeEquipmentCleaning(gymId: string, equipmentId: string): Promise<ApiResponse<GymEquipment>> {
    return apiClient.post<GymEquipment>(`/api/gyms/${gymId}/equipment/${equipmentId}/complete-cleaning`, {});
  }

  async getStaff(gymId: string, role?: GymStaffRole): Promise<ApiResponse<GymStaff[]>> {
    const q = role ? `?role=${encodeURIComponent(role)}` : '';
    return apiClient.get<GymStaff[]>(`/api/gyms/${gymId}/staff${q}`);
  }

  async createStaff(
    gymId: string,
    data: {
      fullName: string;
      email?: string | null;
      phone?: string | null;
      role?: GymStaffRole;
      baseSalary?: number;
      workingHours?: WorkingHourSlot[];
      hiredAt?: string | null;
      notes?: string | null;
    },
  ): Promise<ApiResponse<GymStaff>> {
    return apiClient.post<GymStaff>(`/api/gyms/${gymId}/staff`, data);
  }

  async updateStaff(
    gymId: string,
    staffId: string,
    data: Partial<{
      fullName: string;
      email: string | null;
      phone: string | null;
      role: GymStaffRole;
      baseSalary: number;
      workingHours: WorkingHourSlot[];
      hiredAt: string | null;
      notes: string | null;
      isActive: boolean;
    }>,
  ): Promise<ApiResponse<GymStaff>> {
    return apiClient.patch<GymStaff>(`/api/gyms/${gymId}/staff/${staffId}`, data);
  }

  async deactivateStaff(gymId: string, staffId: string): Promise<ApiResponse<{ ok: boolean; id: string }>> {
    return apiClient.delete(`/api/gyms/${gymId}/staff/${staffId}`);
  }

  async getStaffPayouts(gymId: string, staffId: string): Promise<ApiResponse<{ payouts: GymStaffPayout[] }>> {
    return apiClient.get(`/api/gyms/${gymId}/staff/${staffId}/payouts`);
  }

  async payStaff(
    gymId: string,
    staffId: string,
    data: {
      type: 'salary' | 'bonus';
      provider?: 'mock' | 'paymob' | 'manual' | 'cash';
      bonusAmount?: number;
      bonusOnlyAmount?: number;
      periodMonth?: number;
      periodYear?: number;
      notes?: string | null;
    },
  ): Promise<ApiResponse<GymStaffPayResult>> {
    return apiClient.post(`/api/gyms/${gymId}/staff/${staffId}/pay`, data);
  }

  async confirmStaffPayout(
    gymId: string,
    staffId: string,
    payoutId: string,
  ): Promise<ApiResponse<{ payout: GymStaffPayout }>> {
    return apiClient.post(`/api/gyms/${gymId}/staff/${staffId}/pay/${payoutId}/confirm`, {});
  }

  async getClasses(gymId: string): Promise<ApiResponse<GymClass[]>> {
    return apiClient.get<GymClass[]>(`/api/gyms/${gymId}/classes`);
  }

  async createClass(
    gymId: string,
    data: {
      name: string;
      nameAr?: string | null;
      description?: string | null;
      price: number;
      staffId: string;
      sessionDate: string;
      dayOfWeek?: number;
      startTime: string;
      endTime: string;
      imageUrl?: string | null;
    },
  ): Promise<ApiResponse<GymClass>> {
    return apiClient.post<GymClass>(`/api/gyms/${gymId}/classes`, data);
  }

  async updateClass(
    gymId: string,
    classId: string,
    data: Partial<{
      name: string;
      nameAr: string | null;
      description: string | null;
      price: number;
      staffId: string;
      sessionDate: string;
      dayOfWeek?: number;
      startTime: string;
      endTime: string;
      imageUrl: string | null;
      isActive: boolean;
    }>,
  ): Promise<ApiResponse<GymClass>> {
    return apiClient.patch<GymClass>(`/api/gyms/${gymId}/classes/${classId}`, data);
  }

  async deactivateClass(gymId: string, classId: string): Promise<ApiResponse<{ ok: boolean; id: string }>> {
    return apiClient.delete(`/api/gyms/${gymId}/classes/${classId}`);
  }

  async getTodayClasses(gymId: string): Promise<ApiResponse<GymClass[]>> {
    return apiClient.get<GymClass[]>(`/api/gyms/${gymId}/classes/today`);
  }

  async getClassBookings(
    gymId: string,
    classId: string,
  ): Promise<ApiResponse<{ class: GymClass; bookings: GymClassBooking[] }>> {
    return apiClient.get(`/api/gyms/${gymId}/classes/${classId}/bookings`);
  }

  async updateClassBookingStatus(
    gymId: string,
    classId: string,
    bookingId: string,
    status: 'attended' | 'no_show' | 'cancelled',
  ): Promise<ApiResponse<GymClassBooking>> {
    return apiClient.patch(`/api/gyms/${gymId}/classes/${classId}/bookings/${bookingId}`, { status });
  }

  async getMemberClassBookings(
    gymId: string,
    userId: string,
  ): Promise<ApiResponse<{ bookings: GymClassBooking[] }>> {
    return apiClient.get(`/api/gyms/${gymId}/reception/users/${userId}/class-bookings`);
  }

  async getBasicSessions(gymId: string): Promise<ApiResponse<GymBasicSession[]>> {
    return apiClient.get<GymBasicSession[]>(`/api/gyms/${gymId}/basic-sessions`);
  }

  async getCatalogBasicSessions(gymId: string): Promise<ApiResponse<GymBasicSession[]>> {
    return apiClient.get<GymBasicSession[]>(`/api/gyms/${gymId}/catalog/basic-sessions`);
  }

  async getCatalogClasses(gymId: string): Promise<ApiResponse<GymClass[]>> {
    return apiClient.get<GymClass[]>(`/api/gyms/${gymId}/catalog/classes`);
  }

  async selfBookBasicSession(
    gymId: string,
    sessionId: string,
    data: { paymentMethod: 'cash' | 'card' | 'transfer' | 'online' },
  ): Promise<ApiResponse<{ booking: GymBasicSessionBooking }>> {
    return apiClient.post(`/api/gyms/${gymId}/catalog/basic-sessions/${sessionId}/book`, data);
  }

  async selfBookClassSession(
    gymId: string,
    classId: string,
    data: { paymentMethod: 'cash' | 'card' | 'transfer' | 'online' },
  ): Promise<ApiResponse<{ booking: GymClassBooking }>> {
    return apiClient.post(`/api/gyms/${gymId}/catalog/classes/${classId}/book`, data);
  }

  async updateBasicSession(
    gymId: string,
    sessionId: string,
    data: Partial<{
      name: string;
      nameAr: string | null;
      price: number;
      isActive: boolean;
    }>,
  ): Promise<ApiResponse<GymBasicSession>> {
    return apiClient.patch<GymBasicSession>(`/api/gyms/${gymId}/basic-sessions/${sessionId}`, data);
  }

  async getTodayBasicSessionBookings(gymId: string): Promise<ApiResponse<GymBasicSessionBooking[]>> {
    return apiClient.get<GymBasicSessionBooking[]>(`/api/gyms/${gymId}/basic-sessions/bookings/today`);
  }

  async updateBasicSessionBookingStatus(
    gymId: string,
    sessionId: string,
    bookingId: string,
    status: 'attended' | 'no_show' | 'cancelled',
  ): Promise<ApiResponse<GymBasicSessionBooking>> {
    return apiClient.patch(`/api/gyms/${gymId}/basic-sessions/${sessionId}/bookings/${bookingId}`, { status });
  }

  async bookBasicSession(
    gymId: string,
    sessionId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      address?: string;
      gender?: 'male' | 'female';
      avatarUrl?: string;
      paymentMethod: 'cash' | 'card' | 'transfer' | 'online';
      paidAmount?: number;
      notes?: string;
    },
  ): Promise<ApiResponse<{ accountCreated: boolean; booking: GymBasicSessionBooking }>> {
    return apiClient.post(`/api/gyms/${gymId}/basic-sessions/${sessionId}/bookings`, data);
  }

  async bookClassSession(
    gymId: string,
    classId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      address?: string;
      gender?: 'male' | 'female';
      avatarUrl?: string;
      paymentMethod: 'cash' | 'card' | 'transfer' | 'online';
      paidAmount?: number;
      sessionDate?: string;
    },
  ): Promise<ApiResponse<{ accountCreated: boolean; booking: GymClassBooking }>> {
    return apiClient.post(`/api/gyms/${gymId}/classes/${classId}/bookings`, data);
  }

  async exportPayrollCsv(gymId: string, month?: number, year?: number): Promise<{ error?: string }> {
    const params = new URLSearchParams();
    if (month) params.set('month', String(month));
    if (year) params.set('year', String(year));
    const qs = params.toString();
    try {
      const token = getAuthToken();
      const res = await fetch(
        `${getApiBaseUrl()}/api/gyms/${gymId}/staff/payroll/export${qs ? `?${qs}` : ''}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) {
        let msg = `Export failed (${res.status})`;
        try {
          const json = await res.json();
          if (json?.error) msg = json.error;
        } catch {
          /* ignore */
        }
        return { error: msg };
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payroll-${year ?? new Date().getFullYear()}-${String(month ?? new Date().getMonth() + 1).padStart(2, '0')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return {};
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Export failed' };
    }
  }
}

export const gymService = new GymService();
export default gymService;
