import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import { useAuthStore } from '../../../store/useAuthStore';
import { hasMuscleWikiReveal, markMuscleWikiRevealed } from '../muscleWikiRevealStorage';

type Props = {
  children: React.ReactNode;
  className?: string;
};

export function CaptainHemaFirstVisitReveal({ children, className = '' }: Props) {
  const { t } = useI18n();
  const userId = useAuthStore((s) => s.user?.id);
  const [revealed, setRevealed] = useState(() => hasMuscleWikiReveal(userId));

  const finishReveal = useCallback(() => {
    markMuscleWikiRevealed(userId);
    setRevealed(true);
  }, [userId]);

  useEffect(() => {
    if (revealed || !userId) return;
    const timer = window.setTimeout(finishReveal, 2200);
    return () => window.clearTimeout(timer);
  }, [revealed, userId, finishReveal]);

  return (
    <div className={`relative ${className}`}>
      {children}
      <AnimatePresence>
        {!revealed ? (
          <motion.button
            type="button"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            onClick={finishReveal}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 px-6 text-center rounded-2xl border border-cyan-400/25 bg-slate-900/40 backdrop-blur-md cursor-pointer"
            aria-label={t('muscleWiki.firstVisitRevealCta')}
          >
            <motion.span
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="size-12 rounded-xl bg-cyan-500/20 border border-cyan-400/35 flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-cyan-300 text-2xl">accessibility_new</span>
            </motion.span>
            <p className="text-sm font-bold text-white max-w-[220px] leading-snug">{t('muscleWiki.firstVisitReveal')}</p>
            <span className="text-xs font-semibold text-cyan-300/90">{t('muscleWiki.firstVisitRevealCta')}</span>
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
