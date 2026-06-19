
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { getPostAuthPath } from '../../lib/authRoutes';
import { LandingVideoBackground } from './LandingVideoBackground';
import { LANDING_PILLARS } from './landingContent';
import { LandingFeatureShowcase } from './LandingFeatureShowcase';
import { LandingSectionHeader } from './LandingSectionHeader';
import {
  LANDING_BODY,
  LANDING_CONTAINER,
  LANDING_HEADER_CLASS,
  LANDING_HEADER_INNER_CLASS,
  LANDING_HERO_PT,
  LANDING_SCROLL_MT,
  LANDING_SECTION_PY,
} from './landingUi';
import { motion } from 'framer-motion';
import {
  buttonPress,
  useMotionPrefs,
  staggerContainer,
  maskRevealVariants,
  contentRevealVariants,
} from '../../lib/motion';
import { Logo } from '../../components/shared/Logo';
import { Magnetic, TiltCard } from '../../components/shared/MotionWrappers';
import { useI18n } from '../../lib/i18n/useI18n';
import { LanguageToggle } from '../../components/shared/LanguageToggle';
import { LandingFooter } from './LandingFooter';
import { useLandingScrollOnMount } from './useLandingScrollOnMount';

export const LandingPage: React.FC = () => {
  useLandingScrollOnMount();
  const navigate = useNavigate();
  const { shouldSimplify } = useMotionPrefs();
  const { t, dir, language } = useI18n();
  const { isAuthenticated, authHydrated, user } = useAuthStore();
  const [heroRevealed, setHeroRevealed] = useState(false);

  const revealHero = useCallback(() => setHeroRevealed(true), []);

  useEffect(() => {
    if (shouldSimplify) setHeroRevealed(true);
  }, [shouldSimplify]);

  useEffect(() => {
    if (heroRevealed || shouldSimplify) return;
    const fallback = window.setTimeout(revealHero, 22000);
    return () => window.clearTimeout(fallback);
  }, [heroRevealed, shouldSimplify, revealHero]);

  useEffect(() => {
    if (authHydrated && isAuthenticated && user) {
      navigate(getPostAuthPath(user, 'login'), { replace: true });
    }
  }, [authHydrated, isAuthenticated, user, navigate]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const headlineClass =
    language === 'ar'
      ? 'font-changa font-extrabold tracking-wide'
      : 'font-outfit font-bold uppercase tracking-tight';

  return (
    <motion.div
      dir={dir}
      className="standalone-page safe-top safe-bottom bg-background relative flex min-h-dvh w-full max-w-[100vw] flex-col overflow-x-hidden custom-scrollbar scroll-smooth"
    >
      {/* Cinematic video backdrop — full resolution, portrait vs landscape */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-black">
        <LandingVideoBackground paused={shouldSimplify} onEnded={revealHero} />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.12) 30%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.88) 100%)',
          }}
        />
        <div className="absolute inset-0 bg-primary/[0.04] mix-blend-overlay pointer-events-none" />
      </div>

      {/* Top navigation */}
      <header className={LANDING_HEADER_CLASS}>
        <div dir="ltr" className={LANDING_HEADER_INNER_CLASS}>
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex min-w-0 shrink items-center gap-2 sm:gap-4 lg:gap-5 pointer-events-auto"
          >
            <Logo size="md" className="!gap-0 [&>div]:!w-10 [&>div]:!h-10 sm:[&>div]:!w-14 sm:[&>div]:!h-14 lg:[&>div]:!w-[4.25rem] lg:[&>div]:!h-[4.25rem] xl:[&>div]:!w-20 xl:[&>div]:!h-20" />
            <span dir={dir} className="truncate font-black text-lg sm:text-xl lg:text-2xl tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
              {dir === 'ar' ? 'تكوين' : 'Taqwin'}
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex shrink-0 items-center gap-1.5 sm:gap-3 lg:gap-4 pointer-events-auto"
          >
            <LanguageToggle className="!border-white/25 !bg-black/30 !text-white hover:!text-white !px-3 !py-2 sm:!px-5 sm:!py-3 lg:!px-6 lg:!py-3.5 !text-xs sm:!text-sm lg:!text-base !rounded-lg sm:!rounded-xl !shadow-[0_2px_12px_rgba(0,0,0,0.35)] [&_.material-symbols-outlined]:!text-base sm:[&_.material-symbols-outlined]:!text-lg" />
            <button
              type="button"
              onClick={() => navigate('/auth?mode=signin')}
              className="hidden md:inline-flex px-2 py-2 text-sm lg:text-base font-black uppercase tracking-widest text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] hover:text-white/90 transition-colors"
            >
              {t('landing.signIn')}
            </button>
            <motion.button
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              type="button"
              onClick={() => navigate('/auth')}
              className="whitespace-nowrap bg-primary hover:brightness-110 text-white text-[11px] sm:text-sm lg:text-base font-black uppercase tracking-[0.08em] sm:tracking-[0.1em] px-3.5 py-2.5 sm:px-6 sm:py-3 lg:px-9 lg:py-4 rounded-lg sm:rounded-xl shadow-lg shadow-primary/35 border border-primary/30"
            >
              {t('landing.getStarted')}
            </motion.button>
          </motion.div>
        </div>
      </header>

      <div className="relative z-10 flex w-full min-w-0 flex-1 flex-col">
        {/* Hero */}
        <section className={`relative flex min-h-[100dvh] min-w-0 flex-col justify-end pb-16 ${LANDING_HERO_PT} sm:pb-24 lg:pb-36 ${LANDING_CONTAINER}`}>
          <motion.div
            initial={false}
            animate={{ opacity: heroRevealed ? 1 : 0, y: heroRevealed ? 0 : 28 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className={`w-full min-w-0 space-y-6 sm:space-y-8 lg:space-y-10 ${heroRevealed ? '' : 'pointer-events-none'}`}
            aria-hidden={!heroRevealed}
          >
            <motion.div
              variants={staggerContainer(0.12, 0.35)}
              initial="hidden"
              animate={heroRevealed ? 'visible' : 'hidden'}
              className="max-w-4xl space-y-4 sm:space-y-5 lg:space-y-6"
            >
              <motion.span
                variants={contentRevealVariants}
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-black/40 px-3 py-1.5 text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-[0.18em] sm:tracking-[0.25em] text-white shadow-[0_2px_16px_rgba(0,0,0,0.5)]"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
                <span className="truncate">{t('landing.heroBadge')}</span>
              </motion.span>

              <motion.h1
                variants={maskRevealVariants}
                className={`text-white leading-[1.02] sm:leading-[0.95] text-[clamp(1.65rem,5.5vw+0.75rem,4.75rem)] [text-shadow:0_2px_20px_rgba(0,0,0,0.8),0_4px_40px_rgba(0,0,0,0.5)] ${headlineClass}`}
              >
                {t('landing.heroSloganPrefix')}
                <span className="block mt-2 sm:mt-3 text-accent normal-case [text-shadow:0_2px_16px_rgba(0,0,0,0.65)]">
                  {t('landing.heroSloganRestLead')}
                  <span className="text-white">{t('landing.heroSloganRestHighlight')}</span>
                </span>
              </motion.h1>

              <motion.p
                variants={contentRevealVariants}
                className="max-w-2xl text-sm sm:text-base md:text-lg leading-relaxed font-semibold text-white [text-shadow:0_2px_14px_rgba(0,0,0,0.85)]"
              >
                {t('landing.heroDesc')}
              </motion.p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={heroRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ delay: heroRevealed ? 0.2 : 0, duration: 0.55 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-xl"
            >
              <Magnetic strength={0.25} className="w-full sm:flex-1 min-w-0">
                <motion.button
                  variants={buttonPress}
                  whileHover="hover"
                  whileTap="tap"
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="w-full px-6 py-3.5 sm:px-8 sm:py-4 md:py-5 bg-primary text-white font-black rounded-xl sm:rounded-2xl shadow-xl shadow-primary/35 text-sm sm:text-base md:text-lg border border-primary/20"
                >
                  {t('landing.joinToday')}
                </motion.button>
              </Magnetic>
              <Magnetic strength={0.15} className="w-full sm:flex-1 min-w-0">
                <motion.button
                  variants={buttonPress}
                  whileHover="hover"
                  whileTap="tap"
                  type="button"
                  onClick={() => scrollTo('features')}
                  className="w-full px-6 py-3.5 sm:px-8 sm:py-4 md:py-5 bg-white/15 border border-white/30 text-white font-black rounded-xl sm:rounded-2xl hover:bg-white/20 transition-colors text-sm sm:text-base md:text-lg shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
                >
                  {t('landing.exploreFeatures')}
                </motion.button>
              </Magnetic>
            </motion.div>

            {/* Stats strip */}
            <motion.div
              variants={staggerContainer(0.08, 0.3)}
              initial="hidden"
              animate={heroRevealed ? 'visible' : 'hidden'}
              className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4 pt-2 sm:pt-6 lg:pt-8"
            >
              {[
                { label: t('landing.statUsers'), value: '10K+' },
                { label: t('landing.statWorkouts'), value: '250K+' },
                { label: t('landing.statGyms'), value: '500+' },
                { label: t('landing.statAccuracy'), value: '99%' },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  variants={contentRevealVariants}
                  className="rounded-xl sm:rounded-2xl border border-white/20 bg-black/50 px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5 min-w-0 shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
                >
                  <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white tabular-nums leading-none [text-shadow:0_2px_12px_rgba(0,0,0,0.6)]">
                    {stat.value}
                  </p>
                  <p className="text-[9px] sm:text-[10px] md:text-xs text-white/90 font-black uppercase tracking-wide sm:tracking-wider mt-1.5 sm:mt-2 leading-snug line-clamp-2">
                    {stat.label}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {heroRevealed && !shouldSimplify ? (
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              onClick={() => scrollTo('features')}
              className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 sm:flex flex-col items-center gap-1 text-white/60 hover:text-white/90 transition-colors pointer-events-auto"
              aria-label={t('landing.scrollHint')}
            >
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t('landing.scrollHint')}</span>
              <motion.span
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className="material-symbols-outlined text-xl"
              >
                expand_more
              </motion.span>
            </motion.button>
          ) : null}
        </section>

        {/* Platform pillars */}
        <section id="platform" className={`relative ${LANDING_SCROLL_MT} ${LANDING_SECTION_PY} ${LANDING_CONTAINER}`}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <LandingSectionHeader
            eyebrow={t('landing.platformLabel')}
            title={t('landing.platformTitle')}
            subtitle={t('landing.platformSubtitle')}
          />

          <motion.div
            variants={staggerContainer(0.08, 0.2)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6"
          >
            {LANDING_PILLARS.map((pillar) => (
              <motion.div key={pillar.titleKey} variants={contentRevealVariants}>
                <TiltCard maxTilt={4}>
                  <article className="group h-full rounded-2xl border border-slate-700/60 bg-[#0a141c]/95 p-4 backdrop-blur-xl transition-colors hover:border-primary/35 sm:rounded-3xl sm:p-6 md:p-7 lg:p-8">
                    <div
                      className={`mb-3 flex size-11 items-center justify-center rounded-xl bg-elevated sm:mb-4 sm:size-12 md:mb-5 md:size-14 md:rounded-2xl ${pillar.accent} group-hover:scale-105 transition-transform`}
                    >
                      <span className="material-symbols-outlined text-xl sm:text-2xl md:text-3xl">{pillar.icon}</span>
                    </div>
                    <h3 className="mb-1.5 text-base font-black text-white sm:mb-2 sm:text-lg md:mb-3 md:text-xl lg:text-2xl">{t(pillar.titleKey)}</h3>
                    <p className={`${LANDING_BODY} text-sm sm:text-base`}>{t(pillar.textKey)}</p>
                  </article>
                </TiltCard>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <LandingFeatureShowcase />

        <LandingFooter />
      </div>
    </motion.div>
  );
};
