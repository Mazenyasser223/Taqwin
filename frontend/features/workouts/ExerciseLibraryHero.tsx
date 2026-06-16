import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Logo } from '../../components/shared/Logo';
import { useI18n } from '../../lib/i18n/useI18n';

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  catalogTotal: number;
  muscleZoneCount: number;
  categoryCount: number;
  loading?: boolean;
  onRoutineLibraryOpen: () => void;
  compact?: boolean;
  heading?: string;
  showBack?: boolean;
  onBack?: () => void;
  resultTotal?: number;
  searchPlaceholder?: string;
};

const STAT_ICONS = ['fitness_center', 'accessibility_new', 'category'] as const;

const bodyStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export const ExerciseLibraryHero: React.FC<Props> = ({
  search,
  onSearchChange,
  catalogTotal,
  muscleZoneCount,
  categoryCount,
  loading = false,
  onRoutineLibraryOpen,
  compact = false,
  heading,
  showBack = false,
  onBack,
  resultTotal,
  searchPlaceholder,
}) => {
  const { t, isRtl, language } = useI18n();
  const countLocale = language === 'ar' ? 'ar' : 'en';
  const brandName = language === 'ar' ? 'تكوين' : 'Taqwin';

  const statValues = [
    catalogTotal.toLocaleString(countLocale),
    String(muscleZoneCount),
    String(categoryCount),
  ];
  const statLabels = [
    t('exercises.statExercises'),
    t('exercises.statMuscleGroups'),
    t('exercises.statEquipmentGroups'),
  ];

  const searchField = (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-xl">search</span>
        <p className="text-sm font-black text-foreground">{t('exercises.searchLabel')}</p>
      </div>
      <label className="block w-full min-w-0">
        <span className="sr-only">{t('exercises.search')}</span>
        <div className="relative flex items-center group/search">
          <span className="material-symbols-outlined absolute start-4 text-muted pointer-events-none transition-colors group-focus-within/search:text-primary">
            search
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder ?? t('exercises.searchPlaceholder')}
            className="w-full rounded-xl sm:rounded-2xl border-2 border-subtle/80 bg-background/90 ps-11 sm:ps-12 pe-4 py-3.5 sm:py-4 text-sm sm:text-base font-semibold text-foreground outline-none shadow-inner placeholder:text-muted transition-all focus:border-primary/50 focus:bg-background focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary)_12%,transparent)] focus:ring-0"
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
      <div className="relative overflow-hidden border-b border-subtle/50">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/12 via-primary/5 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -start-16 -top-20 h-44 w-44 rounded-full bg-primary/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -end-10 top-1/2 h-36 w-52 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 start-1/3 h-20 w-40 rounded-full bg-primary/10 blur-2xl"
          aria-hidden
        />
        <div className="relative bg-background/45 px-4 py-4 backdrop-blur-2xl backdrop-saturate-150 sm:px-6 sm:py-5 lg:px-8 lg:py-6 dark:bg-background/35">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="workout-hero-brand-row flex items-center gap-3 sm:gap-4 lg:gap-5 min-w-0 w-full">
              <Logo size="lg" className="shrink-0 drop-shadow-sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:flex-wrap min-[420px]:items-center min-[420px]:gap-2 sm:gap-3">
                  <p className="text-xl sm:text-2xl lg:text-3xl font-black text-foreground leading-none tracking-tight">
                    {brandName}
                  </p>
                  <nav
                    className="workout-hero-nav flex flex-wrap items-center gap-1.5 sm:gap-2"
                    aria-label={t('workouts.area')}
                  >
                    <HeroNavTab
                      type="button"
                      icon="event_repeat"
                      label={t('exercises.routineLibrary')}
                      onClick={onRoutineLibraryOpen}
                    />
                    <HeroNavTab
                      type="link"
                      icon="accessibility_new"
                      label={t('exercises.openMuscleWiki')}
                      to="/muscle-wiki"
                    />
                  </nav>
                </div>
                <p className="mt-1.5 sm:mt-2 text-sm font-bold text-primary">{t('workouts.area')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,color-mix(in_oklab,var(--color-primary)_14%,transparent),transparent_65%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -end-24 bottom-0 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -start-16 top-1/3 h-40 w-40 rounded-full bg-primary/8 blur-3xl"
          aria-hidden
        />

        <motion.div
          variants={bodyStagger}
          initial="hidden"
          animate="show"
          className="relative space-y-6 sm:space-y-7 lg:space-y-8 p-4 sm:p-6 lg:p-8"
        >
          <motion.div variants={fadeUp} className="min-w-0 space-y-3 sm:space-y-4 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-[2.65rem] font-black tracking-tight text-foreground leading-[1.12]">
              {t('exercises.title')}{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                {t('exercises.titleAccent')}
              </span>
            </h1>
            <p className="text-sm sm:text-base lg:text-lg font-medium text-foreground/80 leading-relaxed max-w-xl">
              {t('exercises.subtitle')}
            </p>
          </motion.div>

          {!loading && catalogTotal > 0 ? (
            <motion.div
              variants={fadeUp}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
              aria-live="polite"
            >
              {statValues.map((value, i) => (
                <StatChip
                  key={statLabels[i]}
                  icon={STAT_ICONS[i]}
                  value={value}
                  label={statLabels[i]}
                  accent={i === 0}
                />
              ))}
            </motion.div>
          ) : loading ? (
            <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-elevated/80 animate-pulse border border-subtle/60" />
              ))}
            </motion.div>
          ) : null}

          <motion.div
            variants={fadeUp}
            className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-primary/20 bg-gradient-to-br from-elevated/95 via-background/80 to-primary/5 p-4 sm:p-5 lg:p-6 shadow-[0_16px_48px_-24px_rgba(0,0,0,0.25)] backdrop-blur-md ring-1 ring-primary/10"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
              aria-hidden
            />
            {searchField}
          </motion.div>
        </motion.div>
      </div>
    </motion.header>
  );
};

function StatChip({
  icon,
  value,
  label,
  accent = false,
}: {
  icon: string;
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`group relative overflow-hidden flex items-center gap-3 rounded-xl sm:rounded-2xl border px-3.5 py-3.5 sm:px-4 sm:py-4 lg:py-5 transition-all duration-300 hover:-translate-y-0.5 ${
        accent
          ? 'border-primary/35 bg-gradient-to-br from-primary/15 via-primary/8 to-background/60 shadow-[0_8px_28px_-12px_color-mix(in_oklab,var(--color-primary)_35%,transparent)]'
          : 'border-subtle/70 bg-gradient-to-br from-elevated/90 to-background/70 hover:border-primary/25 hover:shadow-lg'
      }`}
    >
      <div
        className={`flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-xl ${
          accent ? 'bg-primary/20 text-primary ring-1 ring-primary/25' : 'bg-foreground/5 text-foreground/70 ring-1 ring-subtle'
        }`}
      >
        <span className="material-symbols-outlined text-2xl">{icon}</span>
      </div>
      <div className="min-w-0 text-start">
        <span
          className={`block text-xl sm:text-2xl lg:text-3xl font-black tabular-nums leading-none ${
            accent ? 'text-primary' : 'text-foreground'
          }`}
        >
          {value}
        </span>
        <span className="mt-1 block text-[11px] sm:text-xs font-bold text-foreground/70 leading-tight">{label}</span>
      </div>
    </div>
  );
}

function HeroNavTab(
  props:
    | { type: 'button'; icon: string; label: string; onClick: () => void }
    | { type: 'link'; icon: string; label: string; to: string },
) {
  const className =
    'inline-flex items-center gap-1.5 rounded-lg sm:rounded-xl border border-subtle/80 bg-background/70 px-2.5 py-1.5 sm:px-3 sm:py-2 text-[11px] sm:text-xs font-bold text-foreground/90 backdrop-blur-sm transition-all duration-200 hover:border-primary/45 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

  const content = (
    <>
      <span className="material-symbols-outlined text-base sm:text-lg text-primary">{props.icon}</span>
      <span className="max-w-[7rem] sm:max-w-none truncate">{props.label}</span>
    </>
  );

  if (props.type === 'link') {
    return (
      <Link to={props.to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={props.onClick} className={className}>
      {content}
    </button>
  );
}
