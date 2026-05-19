import React from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../../../components/shared/Logo';
import { OnboardingHero3D } from './OnboardingHero3D';
import { SECTION_ORDER, type OnboardingSection } from '../types';

interface OnboardingShellProps {
  section: OnboardingSection;
  completedSections: Set<OnboardingSection>;
  onBack: () => void;
  canGoBack: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showHero3D?: boolean;
}

export const OnboardingShell: React.FC<OnboardingShellProps> = ({
  section,
  completedSections,
  onBack,
  canGoBack,
  children,
  footer,
  showHero3D = false,
}) => {
  const { t, dir } = useI18n();
  const sectionLabel = (sec: OnboardingSection) => t(`onboarding.section.${sec}` as Parameters<typeof t>[0]);
  const sectionIdx = SECTION_ORDER.indexOf(section);
  const progressPct = Math.round(((sectionIdx + 1) / SECTION_ORDER.length) * 100);

  return (
    <motion.div
      dir={dir}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col min-h-[100dvh] max-h-[100dvh] overflow-hidden bg-background text-foreground"
    >
      <div className="flex-shrink-0 px-4 pt-4 md:px-6 md:pt-6 max-w-xl mx-auto w-full space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Logo size="sm" />
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-faint">
            {progressPct}%
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">
            {sectionLabel(section)}
          </p>
          <motion.div
            layout
            className="h-1.5 w-full rounded-full bg-border overflow-hidden"
          >
            <motion.div
              layout
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </motion.div>
          <div className="flex justify-between gap-1 pt-1">
            {SECTION_ORDER.map((sec, i) => {
              const done = completedSections.has(sec);
              const current = sec === section;
              const active = done || current || i < sectionIdx;
              return (
                <motion.div
                  key={sec}
                  layout
                  title={sectionLabel(sec)}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    active ? 'bg-primary/80' : 'bg-border'
                  } ${current ? 'ring-1 ring-primary/50' : ''}`}
                />
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          {showHero3D && (
            <motion.div
              key="hero-3d"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <OnboardingHero3D className="h-36 w-full" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 px-4 md:px-6 max-w-xl mx-auto w-full relative">
        {children}
      </div>

      <div className="flex-shrink-0 px-4 pb-4 md:px-6 md:pb-6 max-w-xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <motion.button
            type="button"
            onClick={onBack}
            disabled={!canGoBack}
            whileTap={canGoBack ? { scale: 0.94 } : undefined}
            className="group flex items-center gap-2 pl-2 pr-4 py-2 rounded-full glass-panel border border-subtle disabled:opacity-25 disabled:pointer-events-none transition-all hover:border-primary/40"
            aria-label="Go back"
          >
            <span className="size-9 rounded-full bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center border border-subtle group-hover:border-primary/50 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M14.5 6.5L9 12l5.5 5.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-xs font-bold text-muted group-hover:text-foreground">{t('common.back')}</span>
          </motion.button>
          {footer}
        </div>
      </div>
    </motion.div>
  );
};
