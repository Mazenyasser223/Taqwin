import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../lib/i18n/useI18n';
import type { TranslationKey } from '../../lib/i18n/translations';
import { contentRevealVariants, staggerContainer } from '../../lib/motion';
import { buildProfileDossier, hasAnyOnboardingAnswers } from './profileDossier';
import type { DossierCategory } from './profileDossier';
import type { Profile } from '../../services/profileService';

interface ProfileCoachDossierProps {
  onboardingData: Record<string, unknown> | null | undefined;
  profile: Profile | null | undefined;
}

function FlowCard({
  category,
  t,
  defaultOpen,
}: {
  category: DossierCategory;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? category.completed);
  const preview = category.fields.slice(0, 3);
  const rest = category.fields.slice(3);

  return (
    <motion.article
      layout
      variants={contentRevealVariants}
      className={`relative overflow-hidden rounded-3xl border bg-gradient-to-br ${category.accent} backdrop-blur-sm`}
    >
      <div className="absolute inset-0 bg-background/40 pointer-events-none" />
      <div className="relative p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <motion.div
            className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${
              category.completed ? 'bg-primary/20 text-primary' : 'bg-elevated text-faint'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">{category.icon}</span>
          </motion.div>
          <div className="min-w-0 flex-1">
            <motion.div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-base sm:text-lg">{t(category.titleKey as TranslationKey)}</h3>
              <span
                className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  category.completed
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                }`}
              >
                {category.completed ? t('profile.dossier.complete') : t('profile.dossier.incomplete')}
              </span>
            </motion.div>
            <p className="text-xs text-muted mt-1">{t(category.subtitleKey as TranslationKey)}</p>
            {category.completedAt && (
              <p className="text-[10px] text-faint mt-1">
                {new Date(category.completedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          {!category.completed && (
            <Link
              to={category.route}
              className="shrink-0 text-[10px] font-black uppercase tracking-wider text-primary hover:underline px-3 py-2 rounded-xl bg-primary/10 border border-primary/20"
            >
              {t('profile.dossier.continue')}
            </Link>
          )}
        </div>

        {category.fields.length === 0 ? (
          <p className="mt-4 text-sm text-faint">{t('profile.dossier.noAnswers')}</p>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {preview.map((field) => (
                <FieldTile key={field.id} label={field.label} value={field.value} chips={field.chips} />
              ))}
            </div>

            {rest.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  className="mt-4 flex items-center gap-1 text-xs font-bold text-primary"
                >
                  <span className="material-symbols-outlined text-base">{open ? 'expand_less' : 'expand_more'}</span>
                  {open ? t('profile.dossier.showLess') : t('profile.dossier.showMore', { count: String(rest.length) })}
                </button>
                <AnimatePresence>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {rest.map((field) => (
                          <FieldTile key={field.id} label={field.label} value={field.value} chips={field.chips} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </>
        )}
      </div>
    </motion.article>
  );
}

function FieldTile({
  label,
  value,
  chips,
}: {
  label: string;
  value: string;
  chips?: string[];
}) {
  return (
    <div className="rounded-2xl bg-surface/60 border border-subtle/80 p-3.5 min-w-0">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-faint mb-1.5 line-clamp-2">{label}</p>
      {chips ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip}
              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-primary/10 text-primary border border-primary/15"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm font-bold text-foreground leading-snug break-words">{value}</p>
      )}
    </div>
  );
}

export const ProfileCoachDossier: React.FC<ProfileCoachDossierProps> = ({ onboardingData, profile }) => {
  const { t } = useI18n();
  const dossier = useMemo(
    () => buildProfileDossier(onboardingData, profile ?? undefined),
    [onboardingData, profile],
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
    <section className="space-y-6">
      <motion.div
        variants={staggerContainer(0.05)}
        initial="hidden"
        animate="visible"
        className="relative overflow-hidden rounded-3xl border border-subtle bg-gradient-to-br from-primary/10 via-background to-accent/5 p-6 sm:p-8"
      >
        <div className="absolute -top-20 -right-20 size-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary mb-2">
              {t('profile.dossier.badge')}
            </p>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{t('profile.dossier.title')}</h2>
            <p className="text-sm text-muted mt-2 max-w-xl">{t('profile.dossier.subtitle')}</p>
            <p className="text-xs text-faint mt-3">
              {t('profile.dossier.fieldsFilled', {
                filled: String(dossier.filledCount),
                total: String(dossier.totalFields),
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            {dossier.highlightStats.map((stat) => (
              <motion.div
                key={stat.labelKey}
                variants={contentRevealVariants}
                className="flex items-center gap-2 rounded-2xl bg-surface/80 border border-subtle px-4 py-3 min-w-[7rem]"
              >
                <span className="material-symbols-outlined text-primary text-xl">{stat.icon}</span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-wider text-faint">
                    {t(stat.labelKey as TranslationKey)}
                  </p>
                  <p className="text-sm font-black">{stat.value}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative mt-6">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-faint mb-2">
            <span>{t('profile.dossier.progress')}</span>
            <span>{dossier.completionPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${dossier.completionPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {dossier.categories.map((cat) => (
              <div key={cat.flow} className="text-center">
                <motion.div
                  className={`mx-auto size-2 rounded-full mb-1 ${cat.completed ? 'bg-primary' : 'bg-border'}`}
                />
                <p className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wide text-faint truncate">
                  {t(cat.titleKey as TranslationKey)}
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
        className="grid grid-cols-1 xl:grid-cols-2 gap-5"
      >
        {dossier.categories.map((cat, i) => (
          <FlowCard key={cat.flow} category={cat} t={t} defaultOpen={i === 0} />
        ))}
      </motion.div>
    </section>
  );
};
