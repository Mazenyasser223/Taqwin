import apiClient from './api';
import { withTransientRetry } from '../lib/apiTransientError';

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
    return withTransientRetry(() => apiClient.get<UserSettings>('/api/settings'), {
      attempts: 4,
      baseDelayMs: 800,
    });
  }

  update(patch: UserSettingsPatch) {
    return withTransientRetry(() => apiClient.patch<UserSettings>('/api/settings', patch), {
      attempts: 3,
      baseDelayMs: 600,
    });
  }
}

export const settingsService = new SettingsService();
export default settingsService;
