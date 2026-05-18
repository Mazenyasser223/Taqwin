import { create } from 'zustand';

import settingsService, {

  type UserSettings,

  type UserSettingsPatch,

  type AppTheme,

  type AppLanguage,

} from '../services/settingsService';

import { applyTheme, applyLanguage } from '../lib/appearance';
import { applyUnitSystem } from '../lib/units';



interface SettingsState {

  settings: UserSettings | null;

  loading: boolean;

  saving: boolean;

  error: string | null;

  load: () => Promise<void>;

  update: (patch: UserSettingsPatch) => Promise<boolean>;

  applyThemeFromSettings: () => void;

  applyLanguageFromSettings: () => void;

}



function applyAll(settings: UserSettings) {
  applyTheme(settings.theme);
  applyLanguage(settings.language);
  applyUnitSystem(settings.unitSystem ?? 'metric');
  if (settings.timezone) {
    localStorage.setItem('taqwin_timezone', settings.timezone);
  }
}



export const useSettingsStore = create<SettingsState>((set, get) => ({

  settings: null,

  loading: false,

  saving: false,

  error: null,



  applyThemeFromSettings: () => {

    const theme =

      get().settings?.theme ?? (localStorage.getItem('taqwin_theme') as AppTheme) ?? 'dark';

    applyTheme(theme === 'light' ? 'light' : 'dark');

  },



  applyLanguageFromSettings: () => {

    const language =

      get().settings?.language ?? (localStorage.getItem('taqwin_lang') as AppLanguage) ?? 'en';

    applyLanguage(language === 'ar' ? 'ar' : 'en');

  },



  load: async () => {

    set({ loading: true, error: null });

    const res = await settingsService.get();

    if (res.error) {

      set({ loading: false, error: res.error });

      return;

    }

    if (res.data) {

      set({ settings: res.data, loading: false });

      applyAll(res.data);

    } else {

      set({ loading: false });

    }

  },



  update: async (patch) => {

    set({ saving: true, error: null });

    const res = await settingsService.update(patch);

    if (res.error) {

      set({ saving: false, error: res.error });

      return false;

    }

    if (res.data) {

      set({ settings: res.data, saving: false });

      applyAll(res.data);

    } else {

      set({ saving: false });

    }

    return true;

  },

}));

