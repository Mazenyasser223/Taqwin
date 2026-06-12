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
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  websiteUrl?: string;
  onboardingData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/** Returned when athlete finishes all questionnaires (Block C4). */
export interface PlanGenerationKickoff {
  triggered: boolean;
  mode?: 'queued' | 'background' | 'skipped';
  jobId?: string;
  status?: string;
  reason?: string;
}

export interface ProfilePatchResult {
  profile: Profile;
  planGeneration?: PlanGenerationKickoff;
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
  async updateProfile(
    data: UpdateProfileData,
  ): Promise<ApiResponse<Profile> & { planGeneration?: PlanGenerationKickoff }> {
    const res = await apiClient.patch<ProfilePatchResult | Profile>('/api/profile', data);
    if (res.error) return { error: res.error };

    const raw = res.data;
    if (raw && typeof raw === 'object' && 'profile' in raw && raw.profile && typeof raw.profile === 'object') {
      const wrapped = raw as ProfilePatchResult;
      return {
        data: wrapped.profile as Profile,
        planGeneration: wrapped.planGeneration,
      };
    }
    if (raw && typeof raw === 'object' && 'userId' in raw) {
      return { data: raw as Profile };
    }
    return { error: 'Invalid profile response' };
  }
}

export const profileService = new ProfileService();
export default profileService;
