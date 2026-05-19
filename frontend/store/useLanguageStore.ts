import { create } from 'zustand';
import { applyLanguage } from '../lib/appearance';
import type { AppLanguage } from '../services/settingsService';
import { useSettingsStore } from './useSettingsStore';

function readStoredLanguage(): AppLanguage {
  const stored = localStorage.getItem('taqwin_lang');
  if (stored === 'en') return 'en';
  return 'ar';
}

interface LanguageState {
  language: AppLanguage;
  setLanguage: (language: AppLanguage, opts?: { skipServer?: boolean }) => void;
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: readStoredLanguage(),
  setLanguage: (language, opts) => {
    applyLanguage(language);
    set({ language });
    const settings = useSettingsStore.getState().settings;
    if (settings && settings.language !== language && !opts?.skipServer) {
      void useSettingsStore.getState().update({ language });
    }
  },
}));

/** Sync language store after server settings load. */
export function syncLanguageFromSettings(language: AppLanguage) {
  applyLanguage(language);
  useLanguageStore.setState({ language });
}
