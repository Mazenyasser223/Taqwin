import React from 'react';
import { useI18n } from '../../lib/i18n/useI18n';
import type { GymClass } from '../../types';
import { resolveMediaUrl } from '../../lib/mediaUrl';
import { cn } from '../../lib/cn';
import { formatClassSchedule } from '../../lib/gymClassSchedule';

const FALLBACK_CLASS_IMAGE =
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=400&fit=crop';

function formatMoney(amount: number, language: string, currency: string) {
  const suffix = language === 'ar' ? ' ج.م' : ` ${currency}`;
  return `${amount.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}${suffix}`;
}

function classLabel(cls: GymClass, language: string) {
  if (language === 'ar' && cls.nameAr) return cls.nameAr;
  return cls.name;
}

interface Props {
  gymClass: GymClass;
  onEdit?: () => void;
  onDelete?: () => void;
  showBook?: boolean;
  onBook?: () => void;
}

export const GymClassCard: React.FC<Props> = ({ gymClass, onEdit, onDelete, showBook, onBook }) => {
  const { t, language } = useI18n();
  const image = gymClass.imageUrl ? resolveMediaUrl(gymClass.imageUrl) : FALLBACK_CLASS_IMAGE;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-default transition-shadow hover:shadow-lg dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-900">
        <img src={image} alt="" className="size-full object-cover" />
        <div className="absolute end-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
          {formatMoney(gymClass.price, language, gymClass.currency)}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h4 className="text-lg font-bold text-gray-900 dark:text-white">{classLabel(gymClass, language)}</h4>
        <p className="mt-1 text-sm font-semibold text-brand-500">
          {gymClass.staff?.fullName ?? t('gymClasses.noTrainer')}
        </p>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {formatClassSchedule(gymClass, language)}
        </p>
        {gymClass.description && (
          <p className="mt-2 line-clamp-2 text-xs text-gray-400">{gymClass.description}</p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          {showBook && (
            <button
              type="button"
              onClick={onBook}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200"
            >
              <span className="material-symbols-outlined text-base">calendar_month</span>
              {t('gymClasses.bookSession')}
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className={cn(
                'rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300',
                !onDelete && 'flex-1'
              )}
            >
              {t('gymClasses.edit')}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10"
            >
              {t('gymClasses.delete')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
