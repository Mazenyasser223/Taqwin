import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import { Logo } from '../../../components/shared/Logo';
import { FLOW_META, type QuestionnaireFlowId } from '../flows/types';
import { PlanPreviewPanel } from './PlanPreviewPanel';
import { QuestionnaireAmbientBackground } from './QuestionnaireAmbientBackground';

const SWIPE_OFFSET = 72;
const SWIPE_VELOCITY = 400;

interface QuestionnaireStepShellProps {
  flow: QuestionnaireFlowId;
  progressPct: number;
  stepIndex: number;
  totalSteps: number;
  stepKey: string;
  onBack: () => void;
  canGoBack: boolean;
  onForward?: () => void;
  canGoForward?: boolean;
  /** When set (e.g. edit from profile), shown beside the back control */
  backLabel?: string;
  onSwipeNext?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onSkipStep?: () => void;
  onSkipAll?: () => void;
  skipDisabled?: boolean;
}

export const QuestionnaireStepShell: React.FC<QuestionnaireStepShellProps> = ({
  flow,
  progressPct,
  stepIndex,
  totalSteps,
  stepKey,
  onBack,
  canGoBack,
  onForward,
  canGoForward = false,
  backLabel,
  onSwipeNext,
  children,
  footer,
  onSkipStep,
  onSkipAll,
  skipDisabled = false,
}) => {
  const { t, dir } = useI18n();
  const reduceMotion = useReducedMotion();
  const [navDir, setNavDir] = useState(1);
  const prevIndex = useRef(stepIndex);

  useEffect(() => {
    if (stepIndex !== prevIndex.current) {
      setNavDir(stepIndex > prevIndex.current ? 1 : -1);
      prevIndex.current = stepIndex;
    }
  }, [stepIndex]);

  const flowTitle =
    t(`onboarding.flow.${flow}.title` as Parameters<typeof t>[0]) || FLOW_META[flow].titleAr;
  const flowSubtitle =
    t(`onboarding.flow.${flow}.subtitle` as Parameters<typeof t>[0]) || FLOW_META[flow].subtitleAr;

  const stepLabel = t('onboarding.stepOf', {
    current: String(stepIndex + 1),
    total: String(totalSteps),
  });

  const slideVariants = {
    enter: (direction: number) => ({
      x: reduceMotion ? 0 : direction * (dir === 'rtl' ? -SWIPE_OFFSET : SWIPE_OFFSET) * 4,
      opacity: reduceMotion ? 1 : 0,
      scale: reduceMotion ? 1 : 0.97,
    }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (direction: number) => ({
      x: reduceMotion ? 0 : direction * (dir === 'rtl' ? SWIPE_OFFSET : -SWIPE_OFFSET) * 4,
      opacity: reduceMotion ? 1 : 0,
      scale: reduceMotion ? 1 : 0.97,
    }),
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const swipeX = info.offset.x;
    const velocityX = info.velocity.x;
    const isRtl = dir === 'rtl';
    const effectiveSwipe = isRtl ? -swipeX : swipeX;
    const effectiveVelocity = isRtl ? -velocityX : velocityX;

    if (effectiveSwipe < -SWIPE_OFFSET || effectiveVelocity < -SWIPE_VELOCITY) {
      onSwipeNext?.();
      return;
    }
    if ((effectiveSwipe > SWIPE_OFFSET || effectiveVelocity > SWIPE_VELOCITY) && canGoBack) {
      onBack();
    }
  };

  return (
    <motion.div
      dir={dir}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative flex flex-1 flex-col min-h-0 h-full w-full lg:flex-row text-foreground overflow-hidden font-[Cairo,'Space_Grotesk',sans-serif]"
    >
      <QuestionnaireAmbientBackground flow={flow} />

      <div className="relative z-10 flex flex-col flex-1 min-w-0 min-h-0 w-full lg:max-w-none">
        <header className="flex-shrink-0 z-10 border-b border-subtle/40 bg-background/70 backdrop-blur-xl px-4 sm:px-6 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:pb-4">
          <div className="max-w-2xl mx-auto w-full space-y-3">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <motion.button
                type="button"
                onClick={onBack}
                disabled={!canGoBack}
                whileTap={canGoBack ? { scale: 0.94 } : undefined}
                className={`flex items-center gap-2 shrink-0 rounded-full glass-panel border transition-colors disabled:opacity-20 disabled:pointer-events-none ${
                  backLabel
                    ? 'ps-2 pe-3 sm:pe-4 py-1.5 border-primary/30 bg-primary/10 hover:bg-primary/15'
                    : 'size-9 sm:size-10 border-subtle justify-center'
                }`}
                aria-label={backLabel ?? t('common.back')}
              >
                <span
                  className={`flex items-center justify-center rounded-full ${
                    backLabel ? 'size-8 border border-primary/25 bg-primary/15' : 'size-full'
                  }`}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className={dir === 'rtl' ? 'scale-x-[-1]' : ''}
                  >
                    <path
                      d="M14.5 6.5L9 12l5.5 5.5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {backLabel ? (
                  <span className="text-[11px] sm:text-xs font-black text-primary whitespace-nowrap">
                    {backLabel}
                  </span>
                ) : null}
              </motion.button>
              <Logo size="sm" />
              <motion.button
                type="button"
                onClick={onForward}
                disabled={!canGoForward}
                whileTap={canGoForward ? { scale: 0.94 } : undefined}
                className="flex items-center justify-center shrink-0 rounded-full glass-panel border border-subtle size-9 sm:size-10 transition-colors disabled:opacity-20 disabled:pointer-events-none hover:border-primary/40"
                aria-label={t('common.forward')}
              >
                <span className="flex items-center justify-center rounded-full size-full">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    className={dir === 'rtl' ? 'scale-x-[-1]' : ''}
                  >
                    <path
                      d="M9.5 6.5L15 12l-5.5 5.5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </motion.button>
            </div>

            <div className="space-y-1.5">
              <motion.div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-primary truncate">
                    {flowTitle}
                  </p>
                  <p className="text-xs sm:text-sm text-muted font-medium leading-snug mt-0.5 line-clamp-2">
                    {flowSubtitle}
                  </p>
                </div>
                <p className="text-[10px] sm:text-xs font-bold text-faint tabular-nums shrink-0">
                  {stepLabel}
                </p>
              </motion.div>
              <div className="h-1.5 sm:h-2 w-full rounded-full bg-border overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary via-primary to-accent rounded-full"
                  initial={false}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                />
              </div>
            </div>

            <motion.div className="hidden min-[720px]:block lg:hidden">
              <PlanPreviewPanel flow={flow} progressPct={progressPct} compact />
            </motion.div>
          </div>
        </header>

        <main className="flex-1 min-h-0 flex flex-col px-3 sm:px-6 py-2 sm:py-3 md:py-4 overflow-hidden">
          <div className="flex-1 min-h-0 w-full max-w-2xl mx-auto flex flex-col min-w-0">
            <AnimatePresence mode="wait" custom={navDir}>
              <motion.div
                key={stepKey}
                custom={navDir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.85 }}
                drag={reduceMotion ? false : 'x'}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.12}
                onDragEnd={handleDragEnd}
                className="flex-1 min-h-0 w-[90%] sm:w-full mx-auto flex flex-col touch-pan-y relative z-10"
              >
                <div className="questionnaire-shiny-card flex flex-col flex-1 min-h-0 rounded-2xl sm:rounded-3xl overflow-hidden">
                  <motion.div className="h-1 sm:h-1.5 w-full bg-gradient-to-r from-primary via-accent to-primary/40 shrink-0 shadow-[0_0_12px_rgba(26,138,138,0.5)]" />
                  <motion.div className="flex-1 min-h-0 flex flex-col overflow-hidden p-3 sm:p-4 md:p-5 lg:p-6">
                    {children}
                  </motion.div>
                </div>
              </motion.div>
            </AnimatePresence>

            <p className="text-center text-[10px] sm:text-xs text-faint mt-1.5 sm:mt-2 px-2 shrink-0">
              {t('onboarding.swipeHint')}
            </p>
          </div>
        </main>

        <footer className="relative z-10 flex-shrink-0 border-t border-subtle/40 bg-background/75 backdrop-blur-xl px-4 sm:px-6 py-3 sm:py-4 safe-bottom">
          <div className="max-w-2xl mx-auto w-full space-y-2">
            {footer}
            {(onSkipStep || onSkipAll) && (
              <div className="flex flex-col sm:flex-row gap-2">
                {onSkipStep && (
                  <button
                    type="button"
                    onClick={onSkipStep}
                    disabled={skipDisabled}
                    className="flex-1 py-2.5 sm:py-3 rounded-xl border border-subtle bg-elevated/50 text-xs sm:text-sm font-bold text-muted hover:text-foreground hover:border-primary/40 disabled:opacity-50 transition-colors"
                  >
                    {t('onboarding.skip')}
                  </button>
                )}
                {onSkipAll && (
                  <button
                    type="button"
                    onClick={onSkipAll}
                    disabled={skipDisabled}
                    className="flex-1 py-2.5 sm:py-3 rounded-xl border border-primary/30 bg-primary/10 text-xs sm:text-sm font-black text-primary hover:bg-primary/15 disabled:opacity-50 transition-colors"
                  >
                    {t('onboarding.skipAll')}
                  </button>
                )}
              </div>
            )}
            <p className="text-center text-[10px] text-faint">{t('onboarding.editLater')}</p>
          </div>
        </footer>
      </div>

      <aside className="relative z-10 hidden lg:flex flex-col w-[min(100%,300px)] xl:w-[340px] shrink-0 border-s border-subtle/40 bg-background/50 backdrop-blur-xl p-4 xl:p-5 overflow-y-auto custom-scrollbar">
        <PlanPreviewPanel flow={flow} progressPct={progressPct} />
      </aside>
    </motion.div>
  );
};
