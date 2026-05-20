import React from 'react';
import { motion } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import { Logo } from '../../../components/shared/Logo';

interface OnboardingCardShellProps {
  onBack: () => void;
  canGoBack: boolean;
  subtitle?: string;
  children: React.ReactNode;
  onSkipStep?: () => void;
  onSkipAll?: () => void;
  skipDisabled?: boolean;
}

export const OnboardingCardShell: React.FC<OnboardingCardShellProps> = ({
  onBack,
  canGoBack,
  subtitle,
  children,
  onSkipStep,
  onSkipAll,
  skipDisabled = false,
}) => {
  const { t, dir } = useI18n();

  return (
    <motion.div
      dir={dir}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[100dvh] flex flex-col bg-background text-foreground"
    >
      <motion.div className="flex-shrink-0 px-4 pt-4 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between">
          <motion.button
            type="button"
            onClick={onBack}
            disabled={!canGoBack}
            whileTap={canGoBack ? { scale: 0.94 } : undefined}
            className="size-10 rounded-full glass-panel border border-subtle flex items-center justify-center disabled:opacity-20"
            aria-label={t('common.back')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M14.5 6.5L9 12l5.5 5.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>
          <Logo size="sm" />
          <span className="size-10" aria-hidden />
        </div>
      </motion.div>

      <motion.div className="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-lg mx-auto w-full min-h-0">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/15 border border-primary/30 px-4 py-1.5"
        >
          <span className="text-primary text-sm font-black">{t('onboarding.card.welcome')}</span>
        </motion.div>
        {subtitle && (
          <p className="text-center text-sm text-muted mb-6 max-w-sm">{subtitle}</p>
        )}
        <motion.div className="w-full flex-1 flex flex-col justify-center min-h-0 overflow-y-auto custom-scrollbar">
          {children}
        </motion.div>
      </motion.div>

      <div className="flex-shrink-0 px-4 pb-6 space-y-2 max-w-lg mx-auto w-full">
        {onSkipStep && (
          <button
            type="button"
            onClick={onSkipStep}
            disabled={skipDisabled}
            className="w-full text-center text-xs text-faint hover:text-muted font-bold disabled:opacity-50 transition-colors"
          >
            {t('onboarding.skip')}
          </button>
        )}
        {onSkipAll && (
          <button
            type="button"
            onClick={onSkipAll}
            disabled={skipDisabled}
            className="w-full py-2.5 rounded-xl border border-subtle bg-elevated/50 text-sm font-bold text-muted hover:text-foreground hover:border-primary/40 disabled:opacity-50 transition-colors"
          >
            {t('onboarding.skipAll')}
          </button>
        )}
        <p className="text-center text-[11px] text-faint">{t('onboarding.editLater')}</p>
      </div>
    </motion.div>
  );
};
