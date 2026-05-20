import { useCallback } from 'react';
import { useLanguageStore } from '../../store/useLanguageStore';
import { translate, type TranslationKey } from './translations';

export function useI18n() {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const dir = language === 'ar' ? 'rtl' : 'ltr';

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string>) => translate(language, key, params),
    [language]
  );

  return { t, language, dir, isRtl: dir === 'rtl', setLanguage };
}
