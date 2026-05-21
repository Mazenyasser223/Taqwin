import React, { useEffect, useRef } from 'react';
import { useI18n } from '../../../lib/i18n/useI18n';
import { motion } from 'framer-motion';
import { Logo } from '../../../components/shared/Logo';
import type { ChatHistoryItem } from '../types';
import { ChatBubble } from './ChatBubble';
import { PlanPreviewPanel } from './PlanPreviewPanel';

interface OnboardingChatShellProps {
  progressPct: number;
  chatHistory: ChatHistoryItem[];
  currentCoachMessage?: string;
  currentCoachImageUrl?: string;
  onBack: () => void;
  canGoBack: boolean;
  /** Current step UI — rendered inside the scroll area below the coach bubble */
  input: React.ReactNode;
  onSkipStep?: () => void;
  onSkipAll?: () => void;
  skipDisabled?: boolean;
}

export const OnboardingChatShell: React.FC<OnboardingChatShellProps> = ({
  progressPct,
  chatHistory,
  currentCoachMessage,
  currentCoachImageUrl,
  onBack,
  canGoBack,
  input,
  onSkipStep,
  onSkipAll,
  skipDisabled = false,
}) => {
  const { t, dir } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatHistory.length, currentCoachMessage, input]);

  return (
    <motion.div
      dir={dir}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-[100dvh] w-full flex flex-col lg:flex-row bg-background text-foreground overflow-hidden"
    >
      <div className="flex flex-col flex-1 min-w-0 min-h-0 w-full max-w-lg mx-auto lg:max-w-none lg:mx-0">
        <header className="flex-shrink-0 px-4 pt-3 pb-2 w-full space-y-2 border-b border-subtle/60 bg-background/90 backdrop-blur-sm z-10">
          <motion.div className="flex items-center justify-between gap-3">
            <motion.button
              type="button"
              onClick={onBack}
              disabled={!canGoBack}
              whileTap={canGoBack ? { scale: 0.94 } : undefined}
              className="size-9 rounded-full glass-panel border border-subtle flex items-center justify-center disabled:opacity-20"
              aria-label={t('common.back')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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
            <span className="text-[10px] font-black text-faint tabular-nums w-9 text-end">
              {progressPct}%
            </span>
          </motion.div>
          <p className="text-center text-xs text-muted font-medium">{t('onboarding.chat.subtitle')}</p>
          <motion.div className="h-1 w-full rounded-full bg-border overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 22 }}
            />
          </motion.div>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain custom-scrollbar px-4 w-full"
        >
          <div className="py-3 space-y-1 max-w-lg mx-auto w-full">
            {chatHistory.map(item => (
              <ChatBubble key={item.id} role={item.role} imageUrl={item.imageUrl}>
                {item.text}
              </ChatBubble>
            ))}
            {currentCoachMessage && (
              <ChatBubble role="coach" imageUrl={currentCoachImageUrl}>
                {currentCoachMessage}
              </ChatBubble>
            )}
            <div className="pt-2 pb-4">{input}</div>
            <div ref={bottomRef} className="h-1" aria-hidden />
          </div>
        </div>

        <footer className="flex-shrink-0 border-t border-subtle bg-background/95 backdrop-blur-md px-4 py-3 w-full safe-bottom">
          <motion.div className="max-w-lg mx-auto w-full space-y-2">
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
            <p className="text-center text-[10px] text-faint">{t('onboarding.editLater')}</p>
          </motion.div>
        </footer>
      </div>

      <aside className="hidden lg:flex flex-col w-[min(100%,300px)] shrink-0 border-s border-subtle bg-surface/30 p-5 overflow-y-auto custom-scrollbar">
        <PlanPreviewPanel progressPct={progressPct} />
      </aside>
    </motion.div>
  );
};
