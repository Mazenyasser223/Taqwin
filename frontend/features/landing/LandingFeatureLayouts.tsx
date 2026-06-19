import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { LandingShowcaseFeature } from './landingContent';
import { LandingFeatureMockup, HeroPhoneChat, CommunityPhoneMockup } from './LandingFeatureMockups';
import { buttonPress } from '../../lib/motion';
import { useI18n } from '../../lib/i18n/useI18n';
import {
  LANDING_BODY_NARROW,
  LANDING_DIVIDER,
  LANDING_GRID_SPLIT,
  LANDING_H2_HERO,
  LANDING_MOCKUP_MAX,
  LANDING_SCROLL_MT,
  LANDING_SECTION_PY_TIGHT,
} from './landingUi';

const SPRING = { type: 'spring' as const, stiffness: 70, damping: 16, mass: 0.9 };
const GLASS = 'bg-black/55 backdrop-blur-xl border border-white/12 shadow-2xl shadow-black/40';
const FLOAT_CARD = `${GLASS} z-20 pointer-events-none`;
const PHONE_STAGE =
  'relative order-1 flex w-full min-w-0 justify-center overflow-visible min-h-[34rem] sm:min-h-[28rem] lg:min-h-[30rem]';
const PHONE_STAGE_INNER = 'relative flex w-full max-w-[min(100%,17.5rem)] justify-center overflow-visible sm:max-w-none';

function useAnimEnabled() {
  return !useReducedMotion();
}

function useIsLgUp() {
  const [isLgUp, setIsLgUp] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsLgUp(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isLgUp;
}

function FloatWrap({
  children,
  delay = 0,
  className = '',
  enabled = true,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  enabled?: boolean;
}) {
  const motionEnabled = useAnimEnabled() && enabled;
  if (!motionEnabled) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      animate={{ y: [0, -14, 0], rotate: [0, 0.6, 0, -0.6, 0] }}
      transition={{ duration: 4.2 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      {children}
    </motion.div>
  );
}

function Glow({ color, className = '' }: { color: string; className?: string }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-[100px] pointer-events-none ${color} ${className}`}
      animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

function FeatureText({
  feature,
  large = false,
  centered = false,
}: {
  feature: LandingShowcaseFeature;
  large?: boolean;
  centered?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });

  return (
    <div
      ref={ref}
      className={`min-w-0 space-y-3 sm:space-y-4 md:space-y-5 ${centered ? 'mx-auto max-w-xl text-center lg:mx-0 lg:max-w-none lg:text-start' : 'max-w-xl'}`}
    >
      <motion.span
        initial={{ opacity: 0, x: -20 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ ...SPRING, delay: 0 }}
        className={`inline-flex max-w-full items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.25em] lg:tracking-[0.3em] ${feature.accent} ${centered ? 'justify-center lg:justify-start' : ''}`}
      >
        <span className="material-symbols-outlined text-sm sm:text-base shrink-0">{feature.icon}</span>
        <span className="truncate">{t(feature.titleKey).split(' ').slice(0, 2).join(' ')}</span>
      </motion.span>

      <motion.h3
        initial={{ opacity: 0, y: 40 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ ...SPRING, delay: 0.08 }}
        className={`font-black text-white leading-[1.08] ${
          large ? LANDING_H2_HERO : 'text-xl sm:text-2xl md:text-3xl lg:text-4xl'
        }`}
      >
        {t(feature.titleKey)}
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 28 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ ...SPRING, delay: 0.16 }}
        className={`${LANDING_BODY_NARROW} ${centered ? 'mx-auto lg:mx-0' : ''}`}
      >
        {t(feature.textKey)}
      </motion.p>

      <ul className="space-y-2.5 pt-1">
        {feature.bulletKeys.map((key, i) => (
          <motion.li
            key={key}
            initial={{ opacity: 0, x: -24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ ...SPRING, delay: 0.24 + i * 0.08 }}
            className={`flex items-start gap-2.5 sm:gap-3 text-sm sm:text-base text-slate-100 ${centered ? 'justify-center text-start lg:justify-start' : ''}`}
          >
            <span className={`material-symbols-outlined text-base sm:text-lg shrink-0 mt-0.5 ${feature.accent}`}>check_circle</span>
            <span className="min-w-0 font-medium leading-relaxed">{t(key)}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function MockupReveal({ feature, fromRight = false }: { feature: LandingShowcaseFeature; fromRight?: boolean }) {
  const ref = useRef(null);
  const isLgUp = useIsLgUp();
  const inView = useInView(ref, { once: true, amount: 0.12, margin: '0px 0px -48px 0px' });
  const shown = isLgUp ? inView : true;
  const slideHorizontal = isLgUp;

  return (
    <div ref={ref} className="relative w-full min-w-0 max-w-full">
      {isLgUp ? (
        <Glow
          color={feature.id === 'ai-coach' ? 'bg-primary/40' : 'bg-primary/25'}
          className={feature.id === 'ai-coach' ? 'w-[80%] h-[80%] -inset-[20%]' : 'inset-0 w-full h-full'}
        />
      ) : null}
      <motion.div
        initial={{
          opacity: slideHorizontal ? 0 : 1,
          x: slideHorizontal ? (fromRight ? 80 : -80) : 0,
          y: slideHorizontal ? 0 : 16,
          scale: slideHorizontal ? 0.92 : 1,
          rotateY: slideHorizontal && fromRight ? -8 : slideHorizontal ? 8 : 0,
        }}
        animate={shown ? { opacity: 1, x: 0, y: 0, scale: 1, rotateY: 0 } : {}}
        transition={{ ...SPRING, delay: 0.1 }}
        style={{ perspective: slideHorizontal ? 1000 : undefined }}
        className="w-full min-w-0 max-w-full"
      >
        <FloatWrap delay={feature.id.length * 0.1} className="w-full min-w-0 max-w-full" enabled={isLgUp}>
          <LandingFeatureMockup type={feature.mockup} className="w-full max-w-full" />
        </FloatWrap>
      </motion.div>
    </div>
  );
}

function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[min(100%,240px)] max-w-[calc(100vw-2rem)] shrink-0 sm:w-[260px] md:w-[270px] lg:w-[300px]">
      <motion.div
        className="relative overflow-hidden rounded-[2.25rem] border-[5px] border-white/15 bg-black shadow-[0_0_60px_rgba(99,102,241,0.3)] sm:rounded-[2.5rem] sm:border-[6px] sm:shadow-[0_0_80px_rgba(var(--color-primary-rgb,99,102,241),0.35)]"
        animate={{ boxShadow: ['0 0 60px rgba(99,102,241,0.25)', '0 0 100px rgba(99,102,241,0.45)', '0 0 60px rgba(99,102,241,0.25)'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute top-3 left-1/2 z-20 h-4 w-16 -translate-x-1/2 rounded-full bg-black sm:h-5 sm:w-20" />
        <div className="relative aspect-[9/19] w-full">{children}</div>
      </motion.div>
    </div>
  );
}

function ActivityBar() {
  const { t } = useI18n();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <div ref={ref} className={`${GLASS} rounded-2xl p-3.5 sm:p-4 md:p-5 w-full max-w-sm`}>
      <p className="text-sm font-bold text-white mb-3">{t('landing.featureActivityDays')}</p>
      <div className="relative h-2.5 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/80 via-emerald-400 to-emerald-300"
          initial={{ width: '0%' }}
          animate={inView ? { width: '78%' } : { width: '0%' }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </div>
      <motion.span
        initial={{ opacity: 0, scale: 0.8 }}
        animate={inView ? { opacity: 1, scale: 1 } : {}}
        transition={{ delay: 1.2, ...SPRING }}
        className="inline-block mt-3 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/90 text-white"
      >
        {t('landing.featureActivityHealthy')}
      </motion.span>
    </div>
  );
}

export function HeroSpotlightBlock({ feature }: { feature: LandingShowcaseFeature }) {
  const { t, isRtl } = useI18n();
  const navigate = useNavigate();
  const isLgUp = useIsLgUp();
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] });
  const phoneY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const textY = useTransform(scrollYProgress, [0, 1], [20, -20]);

  return (
    <article
      id={`feature-${feature.id}`}
      ref={sectionRef}
      className={`${LANDING_SCROLL_MT} relative overflow-visible pb-4 sm:pb-8 ${LANDING_DIVIDER}`}
    >
      <Glow color="bg-primary/30" className="hidden sm:block w-[500px] h-[500px] -top-32 -right-32" />
      <Glow color="bg-accent/20" className="hidden sm:block w-[400px] h-[400px] -bottom-24 -left-24" />

      <div className={`${LANDING_GRID_SPLIT} relative z-10`}>
        <motion.div
          style={isLgUp ? { y: textY } : undefined}
          className="order-2 space-y-6 sm:space-y-8 lg:order-1"
        >
          <FeatureText feature={feature} large />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ...SPRING, delay: 0.4 }}
            className="flex w-full flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-1 sm:pt-2"
          >
            <motion.button
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              type="button"
              onClick={() => navigate('/auth')}
              className="w-full sm:w-auto px-6 py-3.5 sm:px-8 sm:py-4 rounded-full bg-primary text-white font-black text-sm sm:text-base shadow-lg shadow-primary/40"
            >
              {t('landing.featureCtaBandButton')}
            </motion.button>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">{t('landing.featureHeroQuizHint')}</p>
          </motion.div>
        </motion.div>

        <motion.div
          style={isLgUp ? { y: phoneY } : undefined}
          className={`${PHONE_STAGE} lg:order-2`}
        >
          <div className={PHONE_STAGE_INNER}>
            <FloatWrap enabled={isLgUp} className="flex w-full justify-center">
              <PhoneShell>
                <HeroPhoneChat />
              </PhoneShell>
            </FloatWrap>

            <motion.div
              animate={{ y: [0, -10, 0], x: [0, 4, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              className={`absolute top-0 sm:top-8 ${isRtl ? 'left-0 sm:-left-4' : 'right-0 sm:-right-4'} max-w-[46%] sm:max-w-[220px] ${FLOAT_CARD} rounded-xl p-2.5 sm:rounded-2xl sm:p-3.5`}
            >
              <div className="flex items-start gap-2 sm:gap-2.5">
                <span className="size-7 sm:size-9 rounded-lg sm:rounded-xl bg-primary/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-base sm:text-lg">chat</span>
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] font-bold text-primary uppercase tracking-wide leading-tight">
                    {t('landing.featureHeroChatNotifyLabel')}
                  </p>
                  <p className="text-[10px] sm:text-sm font-semibold text-white leading-snug mt-0.5 line-clamp-3 sm:line-clamp-none">
                    {t('landing.featureHeroChatNotify')}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              className={`absolute bottom-[5.5rem] sm:bottom-28 ${isRtl ? 'right-0 sm:right-6' : 'left-0 sm:left-6'} max-w-[44%] sm:max-w-[180px] ${FLOAT_CARD} rounded-lg px-2.5 py-2 sm:rounded-xl sm:px-3 sm:py-2.5`}
            >
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-300 uppercase tracking-wide leading-tight">
                {t('landing.featureHeroChatSuggestLabel')}
              </p>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-1.5">
                <span className="material-symbols-outlined text-primary text-sm sm:text-base">touch_app</span>
                <p className="text-xs sm:text-sm font-black text-white leading-tight">{t('landing.mockAiChip1')}</p>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, -8, 0], rotate: [0, 2, 0] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className={`absolute top-[36%] sm:top-[38%] ${isRtl ? 'left-0 sm:-left-10' : 'right-0 sm:-right-10'} ${FLOAT_CARD} rounded-xl px-2.5 py-2 sm:rounded-2xl sm:px-3 sm:py-2.5`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="material-symbols-outlined text-primary text-base sm:text-lg">stream</span>
                <div>
                  <p className="text-[9px] sm:text-[10px] text-slate-300 font-bold uppercase leading-tight">
                    {t('landing.featureHeroChatStreaming')}
                  </p>
                  <div className="flex gap-1 mt-0.5 sm:mt-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="size-1.5 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </article>
  );
}

export function FeatureSplitRow({
  feature,
  reverse = false,
}: {
  feature: LandingShowcaseFeature;
  reverse?: boolean;
}) {
  const { isRtl } = useI18n();
  const flip = isRtl ? !reverse : reverse;

  return (
    <article id={`feature-${feature.id}`} className={`${LANDING_SCROLL_MT} relative ${LANDING_SECTION_PY_TIGHT} ${LANDING_DIVIDER}`}>
      <div className={`pointer-events-none absolute top-1/2 hidden h-[280px] w-[280px] -translate-y-1/2 lg:block ${flip ? 'right-0' : 'left-0'}`}>
        <Glow color="bg-primary/15 w-full h-full" className="inset-0 opacity-30" />
      </div>

      <div className={LANDING_GRID_SPLIT}>
        <div className={`order-2 space-y-6 lg:order-1 ${flip ? 'lg:order-2' : ''}`}>
          <FeatureText feature={feature} />
          {feature.id === 'nutrition' ? <ActivityBar /> : null}
        </div>
        <div className={`order-1 ${LANDING_MOCKUP_MAX} lg:order-2 ${flip ? 'lg:order-1' : ''}`}>
          <MockupReveal feature={feature} fromRight={flip} />
        </div>
      </div>
    </article>
  );
}

export function FeatureStackRow({
  feature,
  mockFirst = false,
}: {
  feature: LandingShowcaseFeature;
  mockFirst?: boolean;
}) {
  return (
    <article id={`feature-${feature.id}`} className={`${LANDING_SCROLL_MT} relative ${LANDING_SECTION_PY_TIGHT} ${LANDING_DIVIDER}`}>
      <div className={LANDING_GRID_SPLIT}>
        <div className={`order-2 space-y-6 lg:order-1 ${mockFirst ? 'lg:order-2' : ''}`}>
          <FeatureText feature={feature} />
        </div>
        <div className={`order-1 ${LANDING_MOCKUP_MAX} lg:order-2 ${mockFirst ? 'lg:order-1' : ''}`}>
          <MockupReveal feature={feature} fromRight={mockFirst} />
        </div>
      </div>
    </article>
  );
}

export function DualFeatureRow({ features }: { features: [LandingShowcaseFeature, LandingShowcaseFeature] }) {
  const [a, b] = features;

  return (
    <div className={`grid grid-cols-1 gap-12 sm:gap-14 lg:grid-cols-2 lg:gap-16 ${LANDING_SECTION_PY_TIGHT} ${LANDING_DIVIDER}`}>
      {[a, b].map((feature, idx) => (
        <article key={feature.id} id={`feature-${feature.id}`} className={`${LANDING_SCROLL_MT} relative`}>
          {idx === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={SPRING}
              className="mb-8 lg:mb-10"
            >
              <ActivityBar />
            </motion.div>
          ) : null}
          <FeatureText feature={feature} />
          <div className={`mt-8 ${LANDING_MOCKUP_MAX}`}>
            <MockupReveal feature={feature} fromRight={idx === 1} />
          </div>
        </article>
      ))}
    </div>
  );
}

export function CommunityFeatureRow({ feature }: { feature: LandingShowcaseFeature }) {
  const { t, isRtl } = useI18n();
  const isLgUp = useIsLgUp();

  return (
    <article
      id={`feature-${feature.id}`}
      className={`${LANDING_SCROLL_MT} relative overflow-visible ${LANDING_SECTION_PY_TIGHT} ${LANDING_DIVIDER}`}
    >
      <Glow color="bg-rose-500/20" className="hidden sm:block w-[420px] h-[320px] -top-12 -right-16" />

      <div className={LANDING_GRID_SPLIT}>
        <div className={`${PHONE_STAGE} lg:order-2`}>
          <div className={PHONE_STAGE_INNER}>
            <FloatWrap enabled={isLgUp} className="flex w-full justify-center">
              <PhoneShell>
                <CommunityPhoneMockup />
              </PhoneShell>
            </FloatWrap>

            <motion.div
              animate={{ y: [0, -10, 0], x: [0, 4, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              className={`absolute top-0 sm:top-10 ${isRtl ? 'left-0 sm:-left-6' : 'right-0 sm:-right-6'} max-w-[46%] sm:max-w-[210px] ${FLOAT_CARD} rounded-xl p-2.5 sm:rounded-2xl sm:p-3.5`}
            >
              <div className="flex items-start gap-2 sm:gap-2.5">
                <span className="size-7 sm:size-9 rounded-lg sm:rounded-xl bg-rose-500/25 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-rose-400 text-base sm:text-lg">favorite</span>
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] sm:text-[10px] font-bold text-rose-400 uppercase tracking-wide leading-tight">
                    {t('landing.featureCommunityNotifyLabel')}
                  </p>
                  <p className="text-[10px] sm:text-sm font-semibold text-white leading-snug mt-0.5 line-clamp-3 sm:line-clamp-none">
                    {t('landing.featureCommunityNotify')}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              className={`absolute bottom-[5.5rem] sm:bottom-28 ${isRtl ? 'right-0 sm:right-6' : 'left-0 sm:left-6'} ${FLOAT_CARD} rounded-lg px-2.5 py-2 sm:rounded-xl sm:px-3 sm:py-2.5`}
            >
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-300 uppercase tracking-wide leading-tight">
                {t('landing.featureCommunityLikesLabel')}
              </p>
              <p className="text-lg sm:text-xl font-black text-white flex items-center gap-1 mt-0.5">
                48
                <span className="material-symbols-outlined text-rose-400 text-sm sm:text-base">favorite</span>
              </p>
            </motion.div>

            <motion.div
              animate={{ y: [0, -8, 0], rotate: [0, 2, 0] }}
              transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className={`absolute top-[36%] sm:top-[38%] ${isRtl ? 'left-0 sm:-left-10' : 'right-0 sm:-right-10'} ${FLOAT_CARD} rounded-xl px-2.5 py-2 sm:rounded-2xl sm:px-3 sm:py-2.5`}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="material-symbols-outlined text-primary text-base sm:text-lg">chat_bubble</span>
                <div>
                  <p className="text-[9px] sm:text-[10px] text-slate-300 font-bold uppercase leading-tight">
                    {t('landing.featureCommunityCommentsLabel')}
                  </p>
                  <p className="text-primary text-base sm:text-lg font-black">12</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="order-2 min-w-0 max-w-xl lg:order-1">
          <FeatureText feature={feature} large />
        </div>
      </div>
    </article>
  );
}

export function DuoOverlapRow({ features }: { features: [LandingShowcaseFeature, LandingShowcaseFeature] }) {
  const [primary, secondary] = features;
  const isLgUp = useIsLgUp();

  return (
    <div className={`relative ${LANDING_SECTION_PY_TIGHT} ${LANDING_DIVIDER}`}>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-start lg:gap-10">
        <article id={`feature-${primary.id}`} className={`${LANDING_SCROLL_MT} space-y-8 lg:col-span-7`}>
          <FeatureText feature={primary} />
          <div className={LANDING_MOCKUP_MAX}>
            <MockupReveal feature={primary} />
          </div>
        </article>
        <motion.article
          id={`feature-${secondary.id}`}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ ...SPRING, delay: 0.15 }}
          className={`${LANDING_SCROLL_MT} space-y-6 lg:col-span-5 lg:-mt-20 xl:-mt-28`}
        >
          <FeatureText feature={secondary} />
          <div className={LANDING_MOCKUP_MAX}>
            <FloatWrap delay={0.6} enabled={isLgUp}>
              <LandingFeatureMockup type={secondary.mockup} className="w-full max-w-full" />
            </FloatWrap>
          </div>
        </motion.article>
      </div>
    </div>
  );
}

export function CtaBandBlock() {
  const { t, isRtl } = useI18n();
  const navigate = useNavigate();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.35 });

  const joints = [
    { x: '40%', y: '15%' },
    { x: '44%', y: '26%' },
    { x: '50%', y: '38%' },
    { x: '54%', y: '50%' },
    { x: '57%', y: '64%' },
    { x: '60%', y: '78%' },
    { x: '63%', y: '90%' },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className={`relative overflow-visible pt-8 sm:pt-12 ${LANDING_SECTION_PY_TIGHT}`}
    >
      <Glow color="bg-primary/25" className="w-full h-[180px] bottom-0 left-0 opacity-60" />
      <div className={`${LANDING_GRID_SPLIT} relative z-10`}>
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={SPRING}
          className="space-y-6 sm:space-y-8"
        >
          <h2 className={LANDING_H2_HERO}>{t('landing.featureCtaBandTitle')}</h2>
          <motion.button
            variants={buttonPress}
            whileHover="hover"
            whileTap="tap"
            type="button"
            onClick={() => navigate('/auth')}
            className="w-full sm:w-auto px-8 py-4 sm:px-10 sm:py-5 rounded-full bg-primary text-white font-black text-base sm:text-lg shadow-xl shadow-primary/40"
          >
            {t('landing.featureCtaBandButton')}
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ ...SPRING, delay: 0.15 }}
          className="relative min-h-[220px] sm:min-h-[280px] md:min-h-[340px] rounded-2xl sm:rounded-3xl overflow-hidden ring-1 ring-white/10"
        >
          <motion.img
            src="/workouts/categories/chest.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-top"
            loading="lazy"
            draggable={false}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-0 bg-gradient-to-l from-[#060d12]/80 via-transparent to-transparent" />
          {joints.map((joint, i) => (
            <motion.span
              key={`j-${i}`}
              className="absolute size-3 rounded-full bg-primary border-2 border-white/80 shadow-[0_0_12px_rgba(var(--color-primary-rgb,99,102,241),0.8)]"
              style={{ left: joint.x, top: joint.y, transform: 'translate(-50%,-50%)' }}
              initial={{ scale: 0 }}
              animate={inView ? { scale: [0, 1.3, 1] } : {}}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
            />
          ))}
          <div className={`absolute bottom-5 ${isRtl ? 'left-5' : 'right-5'} ${GLASS} rounded-full px-4 py-2 flex items-center gap-2`}>
            <motion.span className="size-2 rounded-full bg-primary" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            <span className="text-xs font-bold text-white">{t('landing.mockMuscleWikiLive')}</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
