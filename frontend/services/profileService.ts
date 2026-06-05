/**
 * Profile Service
 * Handles user profile operations
 */

import apiClient, { ApiResponse } from './api';

export interface Profile {
  id: string;
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  coverUrl?: string;
  dateOfBirth?: string;
  gender?: string;
  height?: number; // cm
  weight?: number; // kg
  fitnessGoal?: string;
  fitnessLevel?: string;
  medicalNotes?: string | null;
  bio?: string;
  specialties?: string;
  yearsExperience?: number | null;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  websiteUrl?: string;
  onboardingData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileData {
  displayName?: string;
  avatarUrl?: string;
  coverUrl?: string;
  dateOfBirth?: string;
  gender?: string;
  height?: number;
  weight?: number;
  fitnessGoal?: string;
  fitnessLevel?: string;
  medicalNotes?: string | null;
  bio?: string;
  specialties?: string;
  yearsExperience?: number | null;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  websiteUrl?: string;
  onboardingData?: Record<string, unknown>;
}

class ProfileService {
  /**
   * Get current user's profile
   */
  async getProfile(): Promise<ApiResponse<Profile>> {
    return apiClient.get<Profile>('/api/profile');
  }

  /**
   * Update current user's profile
   */
  async updateProfile(data: UpdateProfileData): Promise<ApiResponse<Profile>> {
    return apiClient.patch<Profile>('/api/profile', data);
  }
}

export const profileService = new ProfileService();
export default profileService;
