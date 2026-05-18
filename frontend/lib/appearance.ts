import type { AppLanguage, AppTheme } from '../services/settingsService';

export function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme === 'light' ? 'light' : 'dark');
  root.dataset.theme = theme;
  localStorage.setItem('taqwin_theme', theme);
}

export function applyLanguage(language: AppLanguage) {
  const root = document.documentElement;
  root.lang = language;
  root.dir = language === 'ar' ? 'rtl' : 'ltr';
  document.body.dataset.lang = language;
  localStorage.setItem('taqwin_lang', language);
}

/** Apply saved prefs before React mounts (avoids flash). */
export function bootstrapAppearance() {
  const theme = (localStorage.getItem('taqwin_theme') as AppTheme) || 'dark';
  const language = (localStorage.getItem('taqwin_lang') as AppLanguage) || 'en';
  applyTheme(theme === 'light' ? 'light' : 'dark');
  applyLanguage(language === 'ar' ? 'ar' : 'en');
}
