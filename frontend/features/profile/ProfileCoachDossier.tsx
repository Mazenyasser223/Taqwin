import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import type { TranslationKey } from '../../lib/i18n/translations';
import { contentRevealVariants, staggerContainer } from '../../lib/motion';
import { buildProfileDossier, hasAnyOnboardingAnswers, mergeProfileIntoOnboardingData } from './profileDossier';
import type { DossierCategory } from './profileDossier';
import { DossierFieldTile } from './DossierFieldTile';
import { answersFromOnboardingData } from '../../services/onboardingStorage';
import type { OnboardingAnswers } from '../onboarding/types';
import type { QuestionnaireFlowId } from '../onboarding/flows/types';
import type { Profile } from '../../services/profileService';
import nutritionService from '../../services/nutritionService';
import { FLOW_META } from '../onboarding/flows/types';
import { isFlowCompleted } from '../onboarding/questionnaireCompletion';
import { repairFlowCompletionFlag, repairStaleFlowCompletionFlag } from '../onboarding/persistQuestionnaire';
import { useAuthStore } from '../../store/useAuthStore';
import {
  collectFoodCatalogWebtebIds,
  type WebtebFoodNameLookup,
} from '../onboarding/catalogFoodLookup';

interface ProfileCoachDossierProps {
  onboardingData: Record<string, unknown> | null | undefined;
  profile: Profile | null | undefined;
}

function DossierCompletionRing({ pct }: { pct: number }) {
  return (
    <div className="relative size-12 max-[374px]:size-12 sm:size-16 shrink-0 self-center max-[374px]:self-center">
      <svg className="size-full -rotate-90" viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-border/80" strokeWidth="2.5" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          className="stroke-primary transition-all duration-700 ease-out"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${pct} ${100 - pct}`}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs sm:text-base font-black tabular-nums leading-none text-foreground">{pct}%</span>
      </span>
    </div>
  );
}

function FlowCard({
  category,
  t,
  language,
  flowAnswers,
  onFieldSaved,
}: {
  category: DossierCategory;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
  language: 'ar' | 'en';
  flowAnswers: OnboardingAnswers;
  onFieldSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasFields = category.fields.length > 0;

  return (
    <motion.article
      layout
      variants={contentRevealVariants}
      className={`relative w-full min-w-0 max-w-full overflow-hidden rounded-xl max-[374px]:rounded-xl sm:rounded-3xl border bg-gradient-to-br ${category.accent} backdrop-blur-sm`}
    >
      <div className="absolute inset-0 bg-background/40 pointer-events-none" />
      <div className="relative p-3 max-[374px]:p-3 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-2.5 max-[374px]:gap-2.5 sm:flex-row sm:items-start sm:gap-4 w-full min-w-0">
          <button
            type="button"
            onClick={() => hasFields && setOpen((v) => !v)}
            disabled={!hasFields}
            aria-expanded={open}
            className={`flex min-w-0 w-full sm:flex-1 items-start gap-3 sm:gap-4 text-start ${
              hasFields ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            <div
              className={`flex size-10 sm:size-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl ${
                category.completed ? 'bg-primary/20 text-primary' : 'bg-elevated text-faint'
              }`}
            >
              <span className="material-symbols-outlined text-xl sm:text-2xl">{category.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                <h3 className="font-black text-sm sm:text-base lg:text-lg leading-tight">
                  {t(category.titleKey as TranslationKey)}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span
                    className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      category.completed
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                    }`}
                  >
                    {category.completed ? t('profile.dossier.complete') : t('profile.dossier.incomplete')}
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-bold text-faint tabular-nums">
                    {t('profile.dossier.sectionProgress', {
                      answered: String(category.answeredCount),
                      total: String(category.totalCount),
                    })}
                  </span>
                </div>
              </div>
              <p className="text-[11px] sm:text-xs text-muted mt-1 line-clamp-2 sm:line-clamp-none">
                {t(category.subtitleKey as TranslationKey)}
              </p>
              {category.completedAt && (
                <p className="text-[10px] text-faint mt-1">
                  {new Date(category.completedAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                </p>
              )}
            </div>
          </button>

          <div className="flex w-full sm:w-auto shrink-0 items-center justify-end gap-2 sm:pt-0.5">
            <Link
              to={category.completed ? category.restartRoute : category.resumeRoute}
              onClick={(e) => e.stopPropagation()}
              className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-primary hover:underline px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 whitespace-nowrap"
            >
              {category.completed ? t('profile.dossier.editSection') : t('profile.dossier.continue')}
            </Link>
            {hasFields && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={
                  open
                    ? t('profile.dossier.showLess')
                    : t('profile.dossier.showMore', { count: String(category.fields.length) })
                }
                className="flex size-9 sm:size-10 items-center justify-center rounded-lg sm:rounded-xl border border-subtle/80 bg-surface/60 text-primary hover:bg-primary/10 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-lg sm:text-xl">
                  {open ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            )}
          </div>
        </div>

        {!hasFields ? (
          <p className="mt-4 text-sm text-faint">{t('profile.dossier.noAnswers')}</p>
        ) : (
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="fields"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="mt-4 sm:mt-5 grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 max-h-[min(38dvh,20rem)] sm:max-h-[min(44dvh,24rem)] lg:max-h-[min(48dvh,28rem)] overflow-y-auto overflow-x-hidden custom-scrollbar pe-0.5 -me-0.5">
                  {category.fields.map((field) => (
                    <DossierFieldTile
                      key={field.id}
                      field={field}
                      flow={category.flow}
                      answers={flowAnswers}
                      language={language}
                      t={t}
                      onSaved={onFieldSaved}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.article>
  );
}

export const ProfileCoachDossier: React.FC<ProfileCoachDossierProps> = ({ onboardingData, profile }) => {
  const { t, language } = useI18n();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [foodLookup, setFoodLookup] = useState<WebtebFoodNameLookup>({});

  useEffect(() => {
    if (!onboardingData) return;
    const flows = ['core', 'workout', 'diet', 'wellness'] as const;
    let repaired = false;
    for (const flow of flows) {
      const key = FLOW_META[flow].completedKey;
      if (onboardingData[key] && !isFlowCompleted(onboardingData, flow, language)) {
        repaired = true;
        void repairStaleFlowCompletionFlag(flow, language);
      } else if (!onboardingData[key] && isFlowCompleted(onboardingData, flow, language)) {
        repaired = true;
        void repairFlowCompletionFlag(flow, language);
      }
    }
    if (repaired) void refreshUser();
  }, [onboardingData, language, refreshUser]);

  useEffect(() => {
    const ids = collectFoodCatalogWebtebIds(onboardingData ?? undefined);
    if (!ids.length) {
      setFoodLookup({});
      return;
    }
    let cancelled = false;
    void nutritionService.resolveWebtebFoodNames(ids).then((res) => {
      if (cancelled || res.error || !res.data) return;
      setFoodLookup(res.data.names);
    });
    return () => {
      cancelled = true;
    };
  }, [onboardingData, language]);

  const answersByFlow = useMemo(() => {
    const base =
      onboardingData && typeof onboardingData === 'object' ? onboardingData : {};
    const flows: QuestionnaireFlowId[] = ['core', 'workout', 'diet', 'wellness'];
    return Object.fromEntries(
      flows.map((flow) => [
        flow,
        answersFromOnboardingData(
          flow === 'core' ? mergeProfileIntoOnboardingData(base, profile) : base,
        ),
      ]),
    ) as Record<QuestionnaireFlowId, OnboardingAnswers>;
  }, [onboardingData, profile]);

  const dossier = useMemo(
    () => buildProfileDossier(onboardingData, profile ?? undefined, language, foodLookup),
    [onboardingData, profile, language, foodLookup],
  );

  if (!hasAnyOnboardingAnswers(onboardingData) && !dossier) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent p-8 text-center">
        <span className="material-symbols-outlined text-4xl text-primary/60 mb-3">psychology</span>
        <h2 className="text-lg font-black">{t('profile.dossier.title')}</h2>
        <p className="text-sm text-muted mt-2 max-w-md mx-auto">{t('profile.dossier.empty')}</p>
        <Link
          to="/onboarding"
          className="inline-flex mt-6 items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-black text-sm"
        >
          <span className="material-symbols-outlined text-lg">play_arrow</span>
          {t('profile.dossier.startSetup')}
        </Link>
      </section>
    );
  }

  if (!dossier) return null;

  return (
    <section className="profile-coach-dossier w-full min-w-0 max-w-full space-y-4 sm:space-y-6">
      <motion.div
        variants={staggerContainer(0.05)}
        initial="hidden"
        animate="visible"
        className="glass-panel dossier-hero relative w-full min-w-0 overflow-hidden rounded-xl sm:rounded-2xl border border-primary/20 ring-1 ring-primary/10 shadow-[0_4px_24px_-6px_rgba(21,139,141,0.15)] p-3 max-[374px]:p-3 sm:p-5"
      >
        <div className="absolute -top-16 -end-16 size-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -start-16 size-36 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col gap-2.5 max-[374px]:gap-2.5 sm:gap-4 xl:flex-row xl:items-start xl:justify-between w-full min-w-0">
          <div className="flex gap-2.5 max-[374px]:gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="flex size-9 max-[374px]:size-9 sm:size-11 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20 border border-primary/20">
              <span className="material-symbols-outlined text-lg sm:text-xl text-primary">psychology</span>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wide text-primary">
                {t('profile.dossier.badge')}
              </p>
              <h2 className="text-sm max-[374px]:text-sm sm:text-lg font-black tracking-tight leading-snug text-foreground">
                {t('profile.dossier.title')}
              </h2>
              <p className="text-xs sm:text-sm text-foreground/75 leading-relaxed max-w-lg">
                {t('profile.dossier.subtitle')}
              </p>
              <p className="inline-flex items-center gap-1.5 pt-0.5 text-xs sm:text-sm font-medium text-muted">
                <span className="material-symbols-outlined text-base text-primary/90">fact_check</span>
                {t('profile.dossier.fieldsFilled', {
                  filled: String(dossier.filledCount),
                  total: String(dossier.totalFields),
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-col max-[374px]:flex-col min-[375px]:flex-row items-stretch min-[375px]:items-center gap-2 max-[374px]:gap-2 sm:gap-3 shrink-0 w-full xl:w-auto">
            <DossierCompletionRing pct={dossier.completionPct} />
            <div className="grid grid-cols-2 max-[374px]:grid-cols-2 gap-1 max-[374px]:gap-1 sm:gap-2 flex-1 min-w-0 sm:flex-none">
              {dossier.highlightStats.map((stat) => (
                <motion.div
                  key={stat.labelKey}
                  variants={contentRevealVariants}
                  className="flex items-center gap-1.5 max-[374px]:gap-1.5 sm:gap-2 rounded-lg bg-surface/70 border border-subtle/80 px-2 py-1.5 max-[374px]:px-2 max-[374px]:py-1.5 sm:px-2.5 sm:py-2 min-w-0 sm:min-w-[6.25rem]"
                >
                  <span className="flex size-6 max-[374px]:size-6 sm:size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-xs sm:text-sm">{stat.icon}</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-muted truncate">
                      {t(stat.labelKey as TranslationKey)}
                    </p>
                    <p className="text-[11px] max-[374px]:text-[11px] sm:text-sm font-bold text-foreground truncate">{stat.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-subtle/50 w-full min-w-0">
          <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-semibold text-muted mb-2">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-primary">trending_up</span>
              {t('profile.dossier.progress')}
            </span>
            <span className="tabular-nums text-primary font-bold">{dossier.completionPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-border/80 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${dossier.completionPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            />
          </div>
          <div className="mt-2 max-[374px]:mt-2 sm:mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-1 max-[374px]:gap-1 sm:gap-2">
            {dossier.categories.map((cat) => (
              <div
                key={cat.flow}
                className={`flex flex-col items-center gap-0.5 max-[374px]:gap-0.5 sm:gap-1 rounded-lg px-1.5 max-[374px]:px-1.5 py-1.5 max-[374px]:py-1.5 sm:px-2 sm:py-2 min-w-0 border ${
                  cat.completed
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-surface/50 border-subtle/60'
                }`}
              >
                <div className="flex items-center gap-0.5">
                  <span className={`material-symbols-outlined text-sm ${cat.completed ? 'text-primary' : 'text-muted'}`}>
                    {cat.icon}
                  </span>
                  {cat.completed && (
                    <span className="material-symbols-outlined text-xs text-primary">check_circle</span>
                  )}
                </div>
                <p className="text-[10px] sm:text-[11px] font-semibold text-foreground/85 truncate w-full text-center leading-tight">
                  {t(cat.titleKey as TranslationKey)}
                </p>
                <p className="text-[10px] sm:text-[11px] font-medium tabular-nums text-muted">
                  {cat.answeredCount}/{cat.totalCount}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 w-full min-w-0"
      >
        {dossier.categories.map((cat) => (
          <FlowCard
            key={cat.flow}
            category={cat}
            t={t}
            language={language}
            flowAnswers={answersByFlow[cat.flow]}
            onFieldSaved={() => void refreshUser()}
          />
        ))}
      </motion.div>
    </section>
  );
};
