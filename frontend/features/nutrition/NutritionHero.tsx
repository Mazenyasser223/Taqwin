import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { TranslationKey } from '../../lib/i18n/translations';

type Props = {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
  categoryLabel?: string | null;
};

export const NutritionHero: React.FC<Props> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  categoryLabel,
}) => {
  const { t, isRtl } = useI18n();

  const titleKey: TranslationKey = categoryLabel
    ? 'nutrition.heroTitleCategory'
    : 'nutrition.heroTitle';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit();
  };

  return (
    <header className="text-center space-y-6 max-w-3xl mx-auto">
      <div className="space-y-3">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground leading-snug">
          {categoryLabel ? t(titleKey, { category: categoryLabel }) : t(titleKey)}
        </h1>
        <p className="text-sm sm:text-base text-muted font-medium leading-relaxed">
          {t('nutrition.heroSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto w-full">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute start-4 top-1/2 -translate-y-1/2 text-faint pointer-events-none">
            search
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('nutrition.searchPlaceholder')}
            className="w-full bg-elevated border border-subtle rounded-2xl ps-12 pe-4 py-4 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent/40 placeholder:text-faint"
            dir={isRtl ? 'rtl' : 'ltr'}
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 px-8 py-4 rounded-2xl bg-accent text-white font-black text-sm uppercase tracking-widest hover:opacity-90 transition-opacity"
        >
          {t('nutrition.searchButton')}
        </button>
      </form>
    </header>
  );
};
