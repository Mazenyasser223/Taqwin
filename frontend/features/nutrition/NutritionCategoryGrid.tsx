import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import { resolveCategoryLabel } from './nutritionLocale';
import type { FdcCategory } from '../../types';
import { CategoryCardBackground } from './CategoryCardBackground';
import { PageSkeleton } from '../../components/ui/PageSkeleton';

type Props = {
  categories: FdcCategory[];
  loading?: boolean;
  onSelect: (id: string) => void;
  onPrefetch?: (id: string) => void;
};

export const NutritionCategoryGrid: React.FC<Props> = ({ categories, loading, onSelect, onPrefetch }) => {
  const { t, language } = useI18n();

  return (
    <section className="space-y-5">
      <h2 className="text-lg sm:text-xl font-black text-foreground text-center">
        {t('nutrition.categoriesTitle')}
      </h2>
      {loading && categories.length === 0 ? (
        <PageSkeleton variant="grid" className="px-0" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {categories.map((cat) => {
            const label = resolveCategoryLabel(cat.id, cat.nameAr ?? null, t, language, cat.query);

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelect(cat.id)}
                onMouseEnter={() => onPrefetch?.(cat.id)}
                onFocus={() => onPrefetch?.(cat.id)}
                className="group relative overflow-hidden rounded-2xl border border-subtle/60 aspect-[4/5] min-h-[140px] w-full text-start shadow-md hover:shadow-xl hover:border-accent/50 hover:scale-[1.02] transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                <CategoryCardBackground categoryId={cat.id} />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/25 group-hover:from-black/95 transition-colors"
                  aria-hidden
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none group-hover:ring-white/20" />

                <div className="relative z-10 flex h-full flex-col justify-end p-4">
                  <span className="block font-black text-sm sm:text-[15px] text-white leading-snug line-clamp-3 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                    {label}
                  </span>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-widest text-white/70 opacity-0 group-hover:opacity-100 transition-opacity">
                    {t('nutrition.browseCategory')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
