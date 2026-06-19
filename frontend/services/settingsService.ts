import apiClient, { ApiResponse } from './api';

export type AppLanguage = 'en' | 'ar';
export type AppTheme = 'light' | 'dark';
export type UnitSystem = 'metric' | 'imperial';

export interface UserSettings {
  language: AppLanguage;
  theme: AppTheme;
  unitSystem: UnitSystem;
  timezone: string;
  notifyPromotional: boolean;
  publicProfile: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  telegramEnabled?: boolean;
  telegramSecurityAlerts?: boolean;
  telegramCoachAi?: boolean;
  telegramFitnessAchievements?: boolean;
  telegramOrders?: boolean;
  telegramCommunityMessages?: boolean;
  telegramGroupInvites?: boolean;
  telegramFollowRequests?: boolean;
  telegramSocialActivity?: boolean;
  telegramMentions?: boolean;
  telegramCommunityComments?: boolean;
  telegramDailyDigest?: boolean;
  telegramDailyDigestHour?: string;
  telegramWeeklySummary?: boolean;
  telegramMealReminders?: boolean;
  telegramWorkoutMissed?: boolean;
  telegramAiInsights?: boolean;
  telegramLinked?: boolean;
  telegramLinkedAt?: string | null;
  updatedAt?: string;
}

export type UserSettingsPatch = Partial<UserSettings>;

class SettingsService {
  get() {
    return apiClient.get<UserSettings>('/api/settings');
  }

  update(patch: UserSettingsPatch) {
    return apiClient.patch<UserSettings>('/api/settings', patch);
  }
}

export const settingsService = new SettingsService();
export default settingsService;
