import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { motion } from 'framer-motion';

import { useI18n } from '../../lib/i18n/useI18n';

import { useMotionPrefs } from '../../lib/motion';

import { buttonPress } from '../../lib/motion';

import type { MuscleRegion } from '../muscle-wiki/types';



const CaptainHemaCanvas = lazy(() =>

  import('../muscle-wiki/components/CaptainHemaCanvas').then((m) => ({ default: m.CaptainHemaCanvas })),

);



type Props = { className?: string };



function PreviewFallback() {

  const { t } = useI18n();

  return (

    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-600/30 to-slate-800/50 p-6 text-center">

      <span className="material-symbols-outlined text-4xl text-primary animate-pulse">accessibility_new</span>

      <p className="text-sm font-semibold text-slate-300">{t('landing.mockCaptainHemaLoading')}</p>

    </div>

  );

}



export function LandingMuscleWikiPreview({ className = '' }: Props) {

  const { t } = useI18n();

  const navigate = useNavigate();

  const { shouldSimplify } = useMotionPrefs();

  const [selectedMuscle, setSelectedMuscle] = useState<MuscleRegion | null>(null);

  const [shouldMount, setShouldMount] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);



  useEffect(() => {

    if (shouldSimplify) return;

    const el = containerRef.current;

    if (!el) return;



    const observer = new IntersectionObserver(

      ([entry]) => {

        if (entry.isIntersecting) {

          setShouldMount(true);

          observer.disconnect();

        }

      },

      { rootMargin: '120px', threshold: 0.1 },

    );

    observer.observe(el);

    return () => observer.disconnect();

  }, [shouldSimplify]);



  return (

    <div

      ref={containerRef}

      className={`relative overflow-hidden rounded-xl border border-cyan-400/30 bg-gradient-to-br from-slate-600/20 via-slate-700/15 to-slate-800/30 shadow-lg shadow-cyan-500/10 ${className}`}

    >

      <div

        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(34,211,238,0.12),_transparent_65%)]"

        aria-hidden

      />

      <div className="relative h-[min(52dvh,320px)] min-h-[240px] sm:min-h-[280px]">

        <div className="absolute inset-0 blur-md scale-[1.02] pointer-events-none select-none" aria-hidden>

          {shouldSimplify ? (

            <PreviewFallback />

          ) : shouldMount ? (

            <Suspense fallback={<PreviewFallback />}>

              <CaptainHemaCanvas

                selectedMuscle={selectedMuscle}

                onMuscleSelect={setSelectedMuscle}

                showBranding={false}

                variant="landing"

              />

            </Suspense>

          ) : (

            <PreviewFallback />

          )}

        </div>



        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6 text-center bg-black/35">

          <motion.span

            initial={{ opacity: 0, scale: 0.9 }}

            whileInView={{ opacity: 1, scale: 1 }}

            viewport={{ once: true }}

            className="size-14 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center"

          >

            <span className="material-symbols-outlined text-cyan-300 text-3xl">lock</span>

          </motion.span>

          <motion.button

            variants={buttonPress}

            whileHover="hover"

            whileTap="tap"

            type="button"

            initial={{ opacity: 0, y: 8 }}

            whileInView={{ opacity: 1, y: 0 }}

            viewport={{ once: true }}

            transition={{ delay: 0.08 }}

            onClick={() => navigate('/auth')}

            className="px-6 py-3 rounded-full bg-primary text-white text-sm font-black shadow-lg shadow-primary/30"

          >

            {t('landing.mockMuscleWikiSignUp')}

          </motion.button>

        </div>

      </div>

    </div>

  );

}


