import React from 'react';
import { useLanguageStore } from '../../store/useLanguageStore';
import type { AppLanguage } from '../../services/settingsService';

interface LanguageToggleProps {
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ className = '' }) => {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  const next: AppLanguage = language === 'ar' ? 'en' : 'ar';
  const label = language === 'ar' ? 'EN' : 'AR';

  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      className={`flex items-center gap-2 text-[10px] font-black text-muted hover:text-foreground transition-colors glass px-4 py-2 rounded-xl uppercase tracking-widest border border-subtle ${className}`}
      aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      title={language === 'ar' ? 'English' : 'العربية'}
    >
      <span className="material-symbols-outlined text-[18px]">language</span>
      {label}
    </button>
  );
};
