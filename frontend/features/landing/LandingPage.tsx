
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { getPostAuthPath } from '../../lib/authRoutes';
import { LandingVideoBackground } from './LandingVideoBackground';
import { LANDING_PILLARS, LANDING_STEPS, LANDING_WHY_POINTS } from './landingContent';
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

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { shouldSimplify } = useMotionPrefs();
  const { t, dir, language, isRtl } = useI18n();
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
      className="standalone-page safe-top safe-bottom bg-background relative flex flex-col custom-scrollbar scroll-smooth"
    >
      {/* Cinematic video backdrop — full resolution, portrait vs landscape */}
      <div className="fixed inset-0 z-0 overflow-hidden bg-black">
        <LandingVideoBackground paused={shouldSimplify} onEnded={revealHero} />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.45) 70%, rgba(0,0,0,0.92) 100%)',
          }}
        />
        <div className="absolute inset-0 bg-primary/[0.04] mix-blend-overlay pointer-events-none" />
      </div>

      {/* Top navigation */}
      <header className="fixed top-0 inset-x-0 z-50 safe-top">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 pointer-events-auto"
          >
            <Logo size="sm" />
            <span className="hidden sm:inline font-black text-sm tracking-tight text-white/90">
              Taqwin
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="flex items-center gap-2 sm:gap-3 pointer-events-auto"
          >
            <LanguageToggle />
            <button
              type="button"
              onClick={() => navigate('/auth?mode=signin')}
              className="hidden sm:inline-flex px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white/80 hover:text-white transition-colors"
            >
              {t('landing.signIn')}
            </button>
            <motion.button
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              type="button"
              onClick={() => navigate('/auth')}
              className="bg-primary hover:brightness-110 text-white text-xs sm:text-sm font-black uppercase tracking-[0.15em] px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl shadow-lg shadow-primary/30 border border-primary/25"
            >
              {t('landing.getStarted')}
            </motion.button>
          </motion.div>
        </div>
      </header>

      <div className="relative z-10 w-full flex flex-col">
        {/* Hero */}
        <section className="relative min-h-[100dvh] flex flex-col justify-end px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12 lg:pb-16 w-full max-w-7xl mx-auto">
          <motion.div
            initial={false}
            animate={{ opacity: heroRevealed ? 1 : 0, y: heroRevealed ? 0 : 28 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className={`w-full space-y-8 sm:space-y-10 ${heroRevealed ? '' : 'pointer-events-none'}`}
            aria-hidden={!heroRevealed}
          >
            <motion.div
              variants={staggerContainer(0.12, 0.35)}
              initial="hidden"
              animate={heroRevealed ? 'visible' : 'hidden'}
              className="max-w-4xl space-y-5 sm:space-y-6"
            >
              <motion.span
                variants={contentRevealVariants}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 backdrop-blur-md px-4 py-1.5 text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-white/90"
              >
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                {t('landing.heroBadge')}
              </motion.span>

              <motion.h1
                variants={maskRevealVariants}
                className={`text-white leading-[0.95] text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl ${headlineClass}`}
              >
                {t('landing.heroSloganPrefix')}
                <span className="block mt-2 sm:mt-3 text-accent normal-case">
                  {t('landing.heroSloganRestLead')}
                  <span className="text-white">{t('landing.heroSloganRestHighlight')}</span>
                </span>
              </motion.h1>

              <motion.p
                variants={contentRevealVariants}
                className="text-base sm:text-lg md:text-xl text-white/75 font-medium leading-relaxed max-w-2xl"
              >
                {t('landing.heroDesc')}
              </motion.p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={heroRevealed ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ delay: heroRevealed ? 0.2 : 0, duration: 0.55 }}
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 max-w-xl"
            >
              <Magnetic strength={0.25} className="w-full sm:flex-1">
                <motion.button
                  variants={buttonPress}
                  whileHover="hover"
                  whileTap="tap"
                  type="button"
                  onClick={() => navigate('/auth')}
                  className="w-full px-8 py-4 sm:py-5 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/35 text-base sm:text-lg border border-primary/20"
                >
                  {t('landing.joinToday')}
                </motion.button>
              </Magnetic>
              <Magnetic strength={0.15} className="w-full sm:flex-1">
                <motion.button
                  variants={buttonPress}
                  whileHover="hover"
                  whileTap="tap"
                  type="button"
                  onClick={() => scrollTo('platform')}
                  className="w-full px-8 py-4 sm:py-5 bg-white/10 backdrop-blur-md border border-white/20 text-white font-black rounded-2xl hover:bg-white/15 transition-colors text-base sm:text-lg"
                >
                  {t('landing.explorePlatform')}
                </motion.button>
              </Magnetic>
            </motion.div>

            {/* Stats strip */}
            <motion.div
              variants={staggerContainer(0.08, 0.3)}
              initial="hidden"
              animate={heroRevealed ? 'visible' : 'hidden'}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-4 sm:pt-8"
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
                  className="rounded-2xl border border-white/10 bg-black/35 backdrop-blur-md px-4 py-4 sm:px-5 sm:py-5 min-w-0"
                >
                  <p className="text-2xl sm:text-3xl md:text-4xl font-black text-white tabular-nums leading-none">
                    {stat.value}
                  </p>
                  <p className="text-[10px] sm:text-xs text-primary font-black uppercase tracking-wider mt-2 leading-snug">
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
              onClick={() => scrollTo('platform')}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/50 hover:text-white/80 transition-colors pointer-events-auto"
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
        <section
          id="platform"
          className="relative py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            variants={staggerContainer(0.1, 0.25)}
            className="text-center max-w-3xl mx-auto mb-14 sm:mb-20 space-y-4"
          >
            <motion.span
              variants={contentRevealVariants}
              className="text-primary font-black uppercase tracking-[0.35em] text-xs"
            >
              {t('landing.platformLabel')}
            </motion.span>
            <motion.h2
              variants={maskRevealVariants}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight"
            >
              {t('landing.platformTitle')}
            </motion.h2>
            <motion.p variants={contentRevealVariants} className="text-muted text-base sm:text-lg leading-relaxed">
              {t('landing.platformSubtitle')}
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer(0.08, 0.2)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6"
          >
            {LANDING_PILLARS.map((pillar) => (
              <motion.div key={pillar.titleKey} variants={contentRevealVariants}>
                <TiltCard maxTilt={4}>
                  <article className="group h-full rounded-3xl border border-subtle/80 bg-background/80 backdrop-blur-xl p-6 sm:p-8 hover:border-primary/35 transition-colors">
                    <div
                      className={`size-14 rounded-2xl bg-elevated flex items-center justify-center ${pillar.accent} mb-5 group-hover:scale-105 transition-transform`}
                    >
                      <span className="material-symbols-outlined text-3xl">{pillar.icon}</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-foreground mb-3">{t(pillar.titleKey)}</h3>
                    <p className="text-muted text-sm sm:text-base leading-relaxed">{t(pillar.textKey)}</p>
                  </article>
                </TiltCard>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto"
        >
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer(0.1, 0.2)}
            className="text-center mb-14 sm:mb-20 space-y-4"
          >
            <motion.span variants={contentRevealVariants} className="text-primary font-black uppercase tracking-[0.35em] text-xs">
              {t('landing.stepsLabel')}
            </motion.span>
            <motion.h2 variants={maskRevealVariants} className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight">
              {t('landing.pathTitle')}{' '}
              <span className="italic text-glow text-primary">{t('landing.pathHighlight')}</span>
            </motion.h2>
            <motion.p variants={contentRevealVariants} className="text-muted max-w-2xl mx-auto text-base sm:text-lg">
              {t('landing.stepsSubtitle')}
            </motion.p>
          </motion.div>

          <div className="relative">
            <div
              className="hidden lg:block absolute top-24 left-[16.666%] right-[16.666%] h-px bg-gradient-to-r from-primary/20 via-primary/50 to-primary/20"
              aria-hidden
            />
            <motion.div
              variants={staggerContainer(0.15, 0.25)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-6"
            >
              {LANDING_STEPS.map((step, i) => (
                <motion.div key={step.step} variants={contentRevealVariants} className="relative">
                  <div className="glass-panel rounded-3xl border border-subtle p-7 sm:p-9 h-full flex flex-col">
                    <div className="flex items-center gap-4 mb-6">
                      <span className="text-5xl font-black text-foreground/10 leading-none">{step.step}</span>
                      <div className="size-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">{step.icon}</span>
                      </div>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black mb-3">{t(step.titleKey)}</h3>
                    <p className="text-muted leading-relaxed flex-1">{t(step.textKey)}</p>
                    {i < LANDING_STEPS.length - 1 ? (
                      <span
                        className={`lg:hidden material-symbols-outlined text-primary/40 mt-6 ${isRtl ? 'rotate-180' : ''}`}
                      >
                        south
                      </span>
                    ) : null}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Why Taqwin */}
        <section className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto">
          <div className="rounded-[2rem] sm:rounded-[2.5rem] border border-subtle overflow-hidden bg-gradient-to-br from-background via-elevated/50 to-background">
            <div className="grid lg:grid-cols-2 gap-0">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={staggerContainer(0.1, 0.2)}
                className="p-8 sm:p-12 lg:p-14 space-y-6"
              >
                <motion.span variants={contentRevealVariants} className="text-primary font-black uppercase tracking-[0.35em] text-xs">
                  {t('landing.whyLabel')}
                </motion.span>
                <motion.h2 variants={maskRevealVariants} className="text-3xl sm:text-4xl font-black text-foreground leading-tight">
                  {t('landing.whyTitle')}
                </motion.h2>
                <motion.p variants={contentRevealVariants} className="text-muted text-base sm:text-lg leading-relaxed">
                  {t('landing.whySubtitle')}
                </motion.p>
                <ul className="space-y-4 pt-2">
                  {LANDING_WHY_POINTS.map((point) => (
                    <motion.li
                      key={point.textKey}
                      variants={contentRevealVariants}
                      className="flex items-start gap-3 text-foreground/90"
                    >
                      <span className="material-symbols-outlined text-primary shrink-0 mt-0.5">{point.icon}</span>
                      <span className="font-medium leading-relaxed">{t(point.textKey)}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: isRtl ? -24 : 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="relative min-h-[280px] sm:min-h-[320px] lg:min-h-full bg-gradient-to-br from-primary/20 via-accent/10 to-transparent flex items-center justify-center p-10"
              >
                <div className="text-center space-y-4 max-w-sm">
                  <Logo size="lg" />
                  <p className="text-sm sm:text-base text-muted font-medium leading-relaxed">{t('landing.footerTagline')}</p>
                  <motion.button
                    variants={buttonPress}
                    whileHover="hover"
                    whileTap="tap"
                    type="button"
                    onClick={() => navigate('/auth')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-black text-sm uppercase tracking-wider"
                  >
                    {t('landing.signUpNow')}
                    <span className="material-symbols-outlined text-lg">{isRtl ? 'arrow_back' : 'arrow_forward'}</span>
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8 w-full max-w-4xl mx-auto text-center space-y-8">
          <motion.h2
            initial="hidden"
            whileInView="visible"
            variants={maskRevealVariants}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight"
          >
            {t('landing.ctaTitle')}{' '}
            <span className="text-primary italic">{t('landing.ctaHighlight')}</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-muted text-base sm:text-lg max-w-xl mx-auto"
          >
            {t('landing.ctaSubtitle')}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center"
          >
            <motion.button
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              type="button"
              onClick={() => navigate('/auth')}
              className="px-10 sm:px-14 py-5 bg-white text-background font-black rounded-2xl shadow-2xl text-lg sm:text-xl hover:bg-primary hover:text-white transition-colors"
            >
              {t('landing.signUpNow')}
            </motion.button>
            <motion.button
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              type="button"
              onClick={() => navigate('/auth?mode=signin')}
              className="px-10 sm:px-14 py-5 border border-subtle text-foreground font-black rounded-2xl hover:bg-elevated transition-colors text-lg sm:text-xl"
            >
              {t('landing.signIn')}
            </motion.button>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="w-full py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-t border-subtle bg-background/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex flex-col items-center md:items-start gap-3">
              <div className="flex items-center gap-3">
                <Logo size="sm" />
                <span className="font-bold tracking-tight text-lg">Taqwin Fitness</span>
              </div>
              <p className="text-faint text-sm max-w-xs text-center md:text-left">{t('landing.footerTagline')}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 sm:gap-12">
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">{t('landing.footerLinks')}</h4>
                <div className="flex flex-col gap-2 text-sm text-muted font-bold">
                  <Link to="/auth" className="hover:text-foreground transition-colors">{t('auth.signUp')}</Link>
                  <Link to="/auth?mode=signin" className="hover:text-foreground transition-colors">{t('landing.signIn')}</Link>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">{t('landing.footerCompany')}</h4>
                <div className="flex flex-col gap-2 text-sm text-muted font-bold">
                  <a href="#" className="hover:text-foreground transition-colors">{t('landing.footerAbout')}</a>
                  <a href="#" className="hover:text-foreground transition-colors">{t('landing.footerContact')}</a>
                  <a href="#" className="hover:text-foreground transition-colors">{t('landing.footerCareers')}</a>
                </div>
              </div>
              <div className="space-y-3 hidden sm:block">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">{t('landing.footerHelp')}</h4>
                <div className="flex flex-col gap-2 text-sm text-muted font-bold">
                  <a href="#" className="hover:text-foreground transition-colors">{t('landing.footerPrivacy')}</a>
                  <a href="#" className="hover:text-foreground transition-colors">{t('landing.footerSecurity')}</a>
                  <a href="#" className="hover:text-foreground transition-colors">{t('landing.footerTerms')}</a>
                </div>
              </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto pt-12 mt-12 border-t border-subtle flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-faint text-[10px] font-black uppercase tracking-widest">{t('landing.copyright')}</p>
            <div className="flex gap-5">
              <a href="#" className="text-faint hover:text-primary transition-colors" aria-label="Website">
                <span className="material-symbols-outlined">public</span>
              </a>
              <a href="#" className="text-faint hover:text-primary transition-colors" aria-label="Email">
                <span className="material-symbols-outlined">alternate_email</span>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </motion.div>
  );
};
