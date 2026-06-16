import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '../../components/shared/Logo';
import { useI18n } from '../../lib/i18n/useI18n';
import type { TranslationKey } from '../../lib/i18n/translations';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  catalogTotal: number;
  muscleZoneCount: number;
  equipmentGroupCount: number;
  loading?: boolean;
  onRoutineLibraryOpen: () => void;
  compact?: boolean;
  heading?: string;
  showBack?: boolean;
  onBack?: () => void;
  resultTotal?: number;
};

const HERO_STEPS: { icon: string; key: TranslationKey }[] = [
  { icon: 'grid_view', key: 'exercises.heroStep1' },
  { icon: 'play_circle', key: 'exercises.heroStep2' },
  { icon: 'add_circle', key: 'exercises.heroStep3' },
];

export const ExerciseLibraryHero: React.FC<Props> = ({
  search,
  onSearchChange,
  catalogTotal,
  muscleZoneCount,
  equipmentGroupCount,
  loading = false,
  onRoutineLibraryOpen,
  compact = false,
  heading,
  showBack = false,
  onBack,
  resultTotal,
}) => {
  const { t, isRtl, language } = useI18n();
  const countLocale = language === 'ar' ? 'ar' : 'en';
  const brandName = language === 'ar' ? 'تكوين' : 'Taqwin';

  const searchField = (
    <div className="space-y-2">
      <p className="text-sm font-black text-foreground">{t('exercises.searchLabel')}</p>
      <label className="block w-full min-w-0">
        <span className="sr-only">{t('exercises.search')}</span>
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute start-4 text-muted pointer-events-none">search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('exercises.searchPlaceholder')}
            className="w-full rounded-2xl border-2 border-subtle bg-background ps-12 pe-4 py-3.5 sm:py-4 text-base font-semibold text-foreground outline-none placeholder:text-muted focus:border-primary/50 focus:ring-2 focus:ring-primary/30"
            dir={isRtl ? 'rtl' : 'ltr'}
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
      </label>
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-4 rounded-3xl border border-subtle bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          {showBack && onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-sm font-black text-primary hover:underline"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              {t('exercises.backToBrowse')}
            </button>
          ) : null}
          {heading ? <h2 className="text-xl sm:text-2xl font-black text-foreground">{heading}</h2> : null}
          {resultTotal != null ? (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">
              {t('exercises.totalCount', { count: resultTotal.toLocaleString(countLocale) })}
            </span>
          ) : null}
        </div>
        {searchField}
      </div>
    );
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-3xl border border-subtle bg-surface shadow-lg"
    >
      <div className="border-b border-subtle bg-elevated px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
          <Logo size="lg" className="shrink-0" />
          <div className="text-center sm:text-start min-w-0">
            <p className="text-2xl sm:text-3xl font-black text-foreground leading-none tracking-tight">
              {brandName}
            </p>
            <p className="mt-2 text-sm sm:text-base font-bold text-primary">{t('workouts.area')}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-5 sm:p-7 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3 max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground leading-tight">
              {t('exercises.title')}{' '}
              <span className="text-primary">{t('exercises.titleAccent')}</span>
            </h1>
            <p className="text-base sm:text-lg font-semibold text-foreground leading-relaxed max-w-xl">
              {t('exercises.subtitle')}
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:min-w-[220px]">
            <ActionButton
              icon="event_repeat"
              title={t('exercises.routineLibrary')}
              hint={t('exercises.routineLibraryHint')}
              onClick={onRoutineLibraryOpen}
            />
            <ActionLink
              to="/muscle-wiki"
              icon="accessibility_new"
              title={t('exercises.openMuscleWiki')}
              hint={t('exercises.muscleWikiHint')}
              primary
            />
          </div>
        </div>

        {!loading && catalogTotal > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-xl" aria-live="polite">
            <StatChip
              value={catalogTotal.toLocaleString(countLocale)}
              label={t('exercises.statExercises')}
              accent
            />
            <StatChip value={String(muscleZoneCount)} label={t('exercises.statMuscleGroups')} />
            <StatChip value={String(equipmentGroupCount)} label={t('exercises.statEquipmentGroups')} />
          </div>
        ) : loading ? (
          <div className="grid grid-cols-3 gap-2 max-w-xl">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-elevated animate-pulse border border-subtle" />
            ))}
          </div>
        ) : null}

        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 max-w-3xl">
          {HERO_STEPS.map((step, index) => (
            <li
              key={step.key}
              className="flex items-center gap-3 rounded-2xl border border-subtle bg-elevated px-4 py-3"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-black text-primary">
                {index + 1}
              </span>
              <span className="material-symbols-outlined text-primary text-xl shrink-0">{step.icon}</span>
              <span className="text-sm font-bold text-foreground leading-snug">{t(step.key)}</span>
            </li>
          ))}
        </ol>

        <div className="max-w-3xl rounded-2xl border border-subtle bg-elevated p-4 sm:p-5">{searchField}</div>
      </div>
    </motion.header>
  );
};

function StatChip({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-3 sm:px-3 sm:py-4 text-center ${
        accent ? 'border-primary/40 bg-primary/10' : 'border-subtle bg-elevated'
      }`}
    >
      <span className={`text-xl sm:text-2xl font-black tabular-nums leading-none ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </span>
      <span className="text-[11px] sm:text-xs font-bold text-foreground/75 leading-tight">{label}</span>
    </div>
  );
}

function ActionButton({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: string;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-subtle bg-elevated px-4 py-3 text-start hover:border-primary/40 transition-colors"
    >
      <span className="material-symbols-outlined text-primary text-2xl shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-foreground leading-snug">{title}</span>
        <span className="block text-xs font-semibold text-foreground/65 mt-0.5">{hint}</span>
      </span>
    </button>
  );
}

function ActionLink({
  to,
  icon,
  title,
  hint,
  primary = false,
}: {
  to: string;
  icon: string;
  title: string;
  hint: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-start transition-colors ${
        primary
          ? 'border-primary/40 bg-primary/10 hover:bg-primary/15'
          : 'border-subtle bg-elevated hover:border-primary/40'
      }`}
    >
      <span className="material-symbols-outlined text-primary text-2xl shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className={`block text-sm font-black leading-snug ${primary ? 'text-primary' : 'text-foreground'}`}>
          {title}
        </span>
        <span className="block text-xs font-semibold text-foreground/65 mt-0.5">{hint}</span>
      </span>
    </Link>
  );
}
