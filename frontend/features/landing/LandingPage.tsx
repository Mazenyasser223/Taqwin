
import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { getPostAuthPath } from '../../lib/authRoutes';
import { GymScene } from '../../3d/GymScene';
import { motion } from 'framer-motion';
import { 
  buttonPress, 
  useMotionPrefs, 
  staggerContainer, 
  maskRevealVariants,
  contentRevealVariants,
  weightedTransition 
} from '../../lib/motion';
import { Logo } from '../../components/shared/Logo';
import { Magnetic, TiltCard } from '../../components/shared/MotionWrappers';
import { useI18n } from '../../lib/i18n/useI18n';
import { LanguageToggle } from '../../components/shared/LanguageToggle';

const SloganWavyUnderline: React.FC = () => {
  const gradId = React.useId().replace(/:/g, '');

  return (
    <motion.svg
      className="absolute left-1/2 -translate-x-1/2 -bottom-5 sm:-bottom-6 w-full max-w-[min(100%,18rem)] h-5 overflow-hidden pointer-events-none"
      viewBox="0 0 120 18"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#1a8a8a" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#f37021" stopOpacity="1" />
          <stop offset="100%" stopColor="#1a8a8a" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <motion.path
        d="M2,12 C20,4 40,16 60,10 S95,3 118,11"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.svg>
  );
};

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { shouldSimplify } = useMotionPrefs();
  const { t, dir, language, isRtl } = useI18n();
  const { isAuthenticated, authHydrated, user } = useAuthStore();

  useEffect(() => {
    if (authHydrated && isAuthenticated && user) {
      navigate(getPostAuthPath(user, 'login'), { replace: true });
    }
  }, [authHydrated, isAuthenticated, user, navigate]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <motion.div dir={dir} className="standalone-page safe-top safe-bottom bg-background relative flex flex-col custom-scrollbar scroll-smooth">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <GymScene
          showOrb={false}
          staticFallback={
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <Logo size="xl" />
            </div>
          }
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/80 pointer-events-none" />
      </div>

      <nav
        dir={dir}
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-start px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto w-full pointer-events-none safe-top"
      >
        <motion.div
          initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4 md:gap-8 pointer-events-auto rtl:flex-row-reverse"
        >
          <LanguageToggle />
          <motion.button
            variants={buttonPress}
            whileHover="hover"
            whileTap="tap"
            onClick={() => navigate('/auth')}
            className="bg-primary hover:brightness-110 text-white text-sm sm:text-base font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] px-5 sm:px-8 py-3 sm:py-3.5 rounded-2xl shadow-2xl shadow-primary/40 transition-all border border-primary/20"
          >
            {t('landing.getStarted')}
          </motion.button>
        </motion.div>
      </nav>

      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Hero Section */}
        <section className="min-h-[100dvh] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-12 w-full">
          <div className="max-w-5xl xl:max-w-6xl w-full text-center space-y-8 sm:space-y-10 lg:space-y-12">
            <motion.div 
              variants={staggerContainer(0.2, 0.4)}
              initial="hidden"
              animate="visible"
              className="space-y-6 overflow-hidden w-full max-w-full"
            >
              <motion.div variants={contentRevealVariants} className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full glass border border-primary/30 text-primary text-xs sm:text-sm font-black uppercase tracking-[0.25em] sm:tracking-[0.3em] shadow-xl">
                <span className="material-symbols-outlined text-sm animate-pulse">auto_awesome</span>
                {t('landing.hero')}
              </motion.div>
              
              <div className="overflow-hidden w-full flex justify-center">
                <motion.h1 
                  variants={maskRevealVariants}
                  className="flex w-full flex-col items-center justify-center text-center"
                >
                  <Link
                    to="/"
                    className="flex justify-center origin-center w-[min(100%,16rem)] sm:w-64 md:w-72 lg:w-80 mx-auto hover:opacity-85 transition-opacity"
                  >
                    <Logo size="xl" className="w-full justify-center" />
                  </Link>
                </motion.h1>
              </div>

              <motion.div
                variants={contentRevealVariants}
                className={`relative -mt-1 mb-2 flex flex-col items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3 origin-center max-w-full ${
                  language === 'ar'
                    ? 'rotate-0 sm:rotate-[5deg] md:rotate-[7deg] skew-x-0 sm:skew-x-[-3deg]'
                    : 'rotate-0 sm:-rotate-[5deg] md:-rotate-[7deg] skew-x-0 sm:skew-x-[3deg]'
                }`}
                aria-label={t('landing.heroSlogan')}
              >
                <motion.span
                  className={`block leading-[0.95] text-white ${
                    language === 'ar'
                      ? 'font-changa font-extrabold tracking-wide text-5xl sm:text-6xl md:text-7xl lg:text-8xl'
                      : 'font-outfit font-bold uppercase tracking-tight text-4xl sm:text-5xl md:text-6xl lg:text-7xl'
                  }`}
                  animate={shouldSimplify ? undefined : { scale: [1, 1.02, 1] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {t('landing.heroSloganPrefix')}
                </motion.span>
                <motion.span
                  className={`block leading-tight text-accent text-center mt-2 sm:mt-3 ${
                    language === 'ar'
                      ? 'font-changa font-bold text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] -rotate-2'
                      : 'font-outfit font-semibold uppercase text-2xl sm:text-3xl md:text-4xl lg:text-5xl rotate-2'
                  }`}
                  animate={shouldSimplify ? undefined : { y: [0, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {t('landing.heroSloganRestLead')}
                  <span className="relative inline-block">
                    {t('landing.heroSloganRestHighlight')}
                    <SloganWavyUnderline />
                  </span>
                </motion.span>
              </motion.div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-stretch sm:items-center w-full max-w-3xl mx-auto px-2"
            >
              <Magnetic strength={0.3} className="w-full sm:flex-1 sm:max-w-none">
                <motion.button 
                  variants={buttonPress}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={() => navigate('/auth')}
                  className="w-full px-8 sm:px-12 py-5 sm:py-6 bg-primary text-white font-black rounded-2xl sm:rounded-[2rem] shadow-2xl shadow-primary/40 text-lg sm:text-xl md:text-2xl border border-primary/20"
                >
                  {t('landing.joinToday')}
                </motion.button>
              </Magnetic>
              <Magnetic strength={0.2} className="w-full sm:flex-1 sm:max-w-none">
                <motion.button 
                  variants={buttonPress}
                  whileHover="hover"
                  whileTap="tap"
                  onClick={() => scrollToSection('how-it-works')}
                  className="w-full px-8 sm:px-12 py-5 sm:py-6 glass border border-subtle text-foreground font-black rounded-2xl sm:rounded-[2rem] hover:bg-elevated transition-all text-lg sm:text-xl md:text-2xl"
                >
                  {t('landing.seeHow')}
                </motion.button>
              </Magnetic>
            </motion.div>

            <motion.div 
              variants={staggerContainer(0.1, 1.4)}
              initial="hidden"
              animate="visible"
              className="pt-12 sm:pt-16 lg:pt-24 grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 w-full"
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
                   className="glass p-5 sm:p-6 lg:p-8 rounded-2xl sm:rounded-[2rem] border border-subtle min-w-0"
                 >
                   <p className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-foreground leading-none">{stat.value}</p>
                   <p className="text-xs sm:text-sm md:text-base text-primary uppercase font-black tracking-wide sm:tracking-widest mt-2 sm:mt-3 opacity-80 leading-snug">{stat.label}</p>
                 </motion.div>
               ))}
            </motion.div>
          </div>
        </section>

        {/* How it Works Section */}
        <section id="how-it-works" className="py-20 sm:py-32 lg:py-40 px-4 sm:px-6 lg:px-8 w-full max-w-7xl mx-auto space-y-16 sm:space-y-24 relative z-10">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center space-y-4 mb-20"
          >
             <motion.span variants={contentRevealVariants} className="text-primary font-black uppercase tracking-[0.35em] sm:tracking-[0.5em] text-xs sm:text-sm">{t('landing.stepsLabel')}</motion.span>
             <motion.h2 variants={maskRevealVariants} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-tight">{t('landing.pathTitle')} <br/><span className="italic text-glow">{t('landing.pathHighlight')}</span></motion.h2>
          </motion.div>

          <motion.div 
            variants={staggerContainer(0.2)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-12"
          >
            {[
              { 
                step: '01', 
                title: t('landing.feature1Title'), 
                icon: 'hub', 
                text: t('landing.feature1Text'),
                color: 'text-primary'
              },
              { 
                step: '02', 
                title: t('landing.feature2Title'), 
                icon: 'auto_awesome', 
                text: t('landing.feature2Text'),
                color: 'text-accent'
              },
              { 
                step: '03', 
                title: t('landing.feature3Title'), 
                icon: 'apartment', 
                text: t('landing.feature3Text'),
                color: 'text-blue-400'
              }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                variants={contentRevealVariants}
                className="group relative"
              >
                <div className="absolute -top-10 -left-6 text-[120px] font-black text-foreground/5 select-none pointer-events-none group-hover:text-primary/10 transition-colors">
                  {feature.step}
                </div>
                <TiltCard maxTilt={5}>
                  <div className="glass-panel p-8 sm:p-10 lg:p-12 rounded-3xl sm:rounded-[3.5rem] border border-subtle hover:border-primary/40 transition-all h-full flex flex-col">
                    <div className={`size-20 rounded-[2rem] bg-elevated flex items-center justify-center ${feature.color} mb-10 group-hover:scale-110 transition-transform`}>
                      <span className="material-symbols-outlined text-5xl font-black">{feature.icon}</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black mb-4 sm:mb-6">{feature.title}</h3>
                    <p className="text-muted font-medium leading-relaxed text-base sm:text-lg md:text-xl">{feature.text}</p>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <section className="py-20 sm:py-32 lg:py-40 px-4 sm:px-6 lg:px-8 w-full max-w-5xl mx-auto text-center space-y-10 sm:space-y-12">
            <motion.h2 
              initial="hidden"
              whileInView="visible"
              variants={maskRevealVariants}
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight"
            >
              {t('landing.ctaTitle')} <br/> <span className="text-primary italic">{t('landing.ctaHighlight')}</span>
            </motion.h2>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="flex flex-wrap gap-6 justify-center"
            >
               <motion.button 
                 variants={buttonPress}
                 whileHover="hover"
                 whileTap="tap"
                 onClick={() => navigate('/auth')}
                 className="w-full sm:w-auto px-10 sm:px-14 py-5 sm:py-6 bg-white text-background font-black rounded-2xl sm:rounded-[2rem] shadow-2xl text-xl sm:text-2xl hover:bg-primary hover:text-foreground transition-all"
               >
                 {t('landing.signUpNow')}
               </motion.button>
            </motion.div>
        </section>

        <footer className="w-full py-12 sm:py-16 px-4 sm:px-6 lg:px-8 border-t border-subtle bg-background/60 backdrop-blur-lg">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="flex flex-col items-center md:items-start gap-4">
              <div className="flex items-center gap-3">
                <Logo size="sm" />
                <span className="font-bold tracking-tight text-xl">Taqwin Fitness</span>
              </div>
              <p className="text-faint text-sm max-w-xs text-center md:text-left">{t('landing.footerTagline')}</p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
               <div className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">{t('landing.footerLinks')}</h4>
                 <div className="flex flex-col gap-2 text-sm text-muted font-bold">
                   <Link to="/auth" className="hover:text-foreground transition-colors">{t('auth.signUp')}</Link>
                 </div>
               </div>
               <div className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">{t('landing.footerCompany')}</h4>
                 <div className="flex flex-col gap-2 text-sm text-muted font-bold">
                   <a href="#" className="hover:text-foreground transition-colors">{t('landing.footerAbout')}</a>
                   <a href="#" className="hover:text-foreground transition-colors">{t('landing.footerContact')}</a>
                   <a href="#" className="hover:text-foreground transition-colors">{t('landing.footerCareers')}</a>
                 </div>
               </div>
               <div className="space-y-4 hidden sm:block">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">{t('landing.footerHelp')}</h4>
                 <div className="flex flex-col gap-2 text-sm text-muted font-bold">
                   <a href="#" className="hover:text-foreground transition-colors">{t('landing.footerPrivacy')}</a>
                   <a href="#" className="hover:text-foreground transition-colors">{t('landing.footerSecurity')}</a>
                   <a href="#" className="hover:text-foreground transition-colors">{t('landing.footerTerms')}</a>
                 </div>
               </div>
            </div>
          </div>
          <div className="max-w-7xl mx-auto pt-16 mt-16 border-t border-subtle flex flex-col md:flex-row justify-between items-center gap-6">
             <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">{t('landing.copyright')}</p>
             <div className="flex gap-6">
                <a href="#" className="text-faint hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">public</span>
                </a>
                <a href="#" className="text-faint hover:text-primary transition-colors">
                  <span className="material-symbols-outlined">alternate_email</span>
                </a>
             </div>
          </div>
        </footer>
      </div>
    </motion.div>
  );
};
