import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import { buttonPress } from '../../lib/motion';
import { Magnetic } from '../../components/shared/MotionWrappers';
import { useI18n } from '../../lib/i18n/useI18n';

export interface CoachDisclaimerPanelProps {
  variant?: 'widget' | 'page';
  onAccept: () => void;
}

export function CoachDisclaimerPanel({ variant = 'page', onAccept }: CoachDisclaimerPanelProps) {
  const { t } = useI18n();
  const isPage = variant === 'page';

  return (
    <motion.div
      initial={{ opacity: 0, y: isPage ? 12 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={
        isPage
          ? 'rounded-2xl sm:rounded-[2rem] border border-amber-500/30 bg-amber-500/10 p-5 sm:p-8 shadow-lg'
          : 'rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 shadow-md'
      }
      role="region"
      aria-labelledby="coach-disclaimer-title"
    >
      <div className={`flex items-start gap-3 ${isPage ? 'sm:gap-4' : ''}`}>
        <span
          className={`material-symbols-outlined shrink-0 text-amber-400 ${isPage ? 'text-3xl sm:text-4xl' : 'text-2xl'}`}
          aria-hidden
        >
          health_and_safety
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2
              id="coach-disclaimer-title"
              className={`font-black tracking-tight text-foreground ${isPage ? 'text-lg sm:text-xl' : 'text-sm'}`}
            >
              {t('ai.disclaimer.title')}
            </h2>
            <p className={`mt-2 text-muted leading-relaxed ${isPage ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}>
              {t('ai.disclaimer.lead')}
            </p>
          </div>

          <ul
            className={`list-disc space-y-2 ps-5 text-muted leading-relaxed ${isPage ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}
          >
            <li>{t('ai.disclaimer.notMedical')}</li>
            <li>{t('ai.disclaimer.emergency')}</li>
            <li>{t('ai.disclaimer.aiLimits')}</li>
            <li>{t('ai.disclaimer.consultProfessional')}</li>
          </ul>

          <p className={`text-muted/90 ${isPage ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs'}`}>
            {t('ai.disclaimer.legalNote')}{' '}
            <Link to="/privacy" className="font-semibold text-primary hover:underline">
              {t('ai.disclaimer.privacyLink')}
            </Link>
            {' · '}
            <Link to="/terms" className="font-semibold text-primary hover:underline">
              {t('ai.disclaimer.termsLink')}
            </Link>
          </p>

          <Magnetic strength={isPage ? 0.35 : 0.25}>
            <motion.button
              type="button"
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              onClick={onAccept}
              className={
                isPage
                  ? 'mt-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-black text-white shadow-lg shadow-primary/30 sm:rounded-2xl sm:px-8 sm:text-base'
                  : 'mt-1 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-primary/30 sm:text-sm'
              }
            >
              {t('ai.disclaimer.accept')}
            </motion.button>
          </Magnetic>
        </div>
      </div>
    </motion.div>
  );
}
