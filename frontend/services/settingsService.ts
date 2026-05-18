import apiClient, { ApiResponse } from './api';

export type AppLanguage = 'en' | 'ar';
export type AppTheme = 'light' | 'dark';
export type UnitSystem = 'metric' | 'imperial';

export interface UserSettings {
  language: AppLanguage;
  theme: AppTheme;
  unitSystem: UnitSystem;
  timezone: string;
  notifyWorkoutReminders: boolean;
  notifyAiSuggestions: boolean;
  notifyPromotional: boolean;
  shareWithTrainers: boolean;
  publicProfile: boolean;
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
