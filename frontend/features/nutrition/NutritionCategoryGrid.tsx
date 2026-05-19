import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { TranslationKey } from '../../lib/i18n/translations';
import type { FdcCategory } from '../../types';
import { categoryTileClass } from './nutritionCategoryTheme';

function catKey(id: string): TranslationKey {
  return `nutrition.cat.${id}` as TranslationKey;
}

type Props = {
  categories: FdcCategory[];
  loading?: boolean;
  onSelect: (id: string) => void;
};

export const NutritionCategoryGrid: React.FC<Props> = ({ categories, loading, onSelect }) => {
  const { t, isRtl } = useI18n();

  return (
    <section className="space-y-5">
      <h2 className="text-lg sm:text-xl font-black text-foreground text-center">
        {t('nutrition.categoriesTitle')}
      </h2>
      {loading ? (
        <p className="text-center text-accent animate-pulse">{t('nutrition.loading')}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map((cat) => {
            const tile = categoryTileClass(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelect(cat.id)}
                className={`group flex flex-col items-center gap-3 p-5 rounded-2xl border border-subtle bg-gradient-to-br ${tile} hover:border-accent/40 hover:scale-[1.02] transition-all text-center`}
              >
                <span className="material-symbols-outlined text-3xl">{cat.icon}</span>
                <span className="font-bold text-xs sm:text-sm text-foreground leading-snug line-clamp-2">
                  {t(catKey(cat.id))}
                </span>
                <span className="material-symbols-outlined text-faint text-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  {isRtl ? 'chevron_left' : 'chevron_right'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
