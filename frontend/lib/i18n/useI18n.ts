import { useSettingsStore } from '../../store/useSettingsStore';
import type { AppLanguage } from '../../services/settingsService';
import { translate, type TranslationKey } from './translations';

function resolveLanguage(settingsLang: AppLanguage | undefined): AppLanguage {
  if (settingsLang) return settingsLang;
  const stored = localStorage.getItem('taqwin_lang') as AppLanguage | null;
  return stored === 'ar' ? 'ar' : 'en';
}

export function useI18n() {
  const settingsLang = useSettingsStore((s) => s.settings?.language);
  const language = resolveLanguage(settingsLang);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const t = (key: TranslationKey, params?: Record<string, string>) => translate(language, key, params);

  return { t, language, dir, isRtl: dir === 'rtl' };
}
