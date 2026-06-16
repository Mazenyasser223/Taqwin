
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useMotionPrefs,
  buttonPress,
  staggerContainer,
  weightedTransition,
} from '../../lib/motion';
import { Magnetic } from '../shared/MotionWrappers';
import { ChatVisual } from '../../3d/PageSpecificVisuals';
import { useI18n } from '../../lib/i18n/useI18n';
import { useBreakpoint } from '../../lib/hooks/useBreakpoint';
import { CoachChatThread } from '../../features/ai-chat/CoachChatThread';
import { useCoachChat } from '../../features/ai-chat/useCoachChat';
import { CoachChatComposer } from '../../features/ai-chat/CoachChatComposer';
import { CoachTypingDots } from '../../features/ai-chat/CoachTypingDots';
import { CoachChatStatusBar } from '../../features/ai-chat/CoachChatStatusBar';

export const ChatWidget: React.FC = () => {
  const { pathname } = useLocation();
  const { shouldSimplify } = useMotionPrefs();
  const { isLgUp } = useBreakpoint();
  const { t, language } = useI18n();
  const widgetGreeting = useMemo(() => t('ai.widgetGreeting'), [t, language]);
  const [isOpen, setIsOpen] = useState(false);
  const isCoachPage = pathname === '/ai-assistant';

  useEffect(() => {
    if (isCoachPage) setIsOpen(false);
  }, [isCoachPage]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    input,
    setInput,
    isWaitingReply,
    isSending,
    isStreamingTokens,
    streamPhase,
    connectionState,
    pendingConfirmIndex,
    pendingDisambiguationIndex,
    handleSend,
    handleStopStreaming,
    handleConfirmAction,
    handleCancelAction,
    handlePickFoodCandidate,
    foodCandidateKey,
  } = useCoachChat({
    greeting: widgetGreeting,
    locale: language,
    preWarmWs: isOpen,
    errorNetwork: t('ai.errorLinkFailure'),
    errorTimeout: t('ai.errorTimeout'),
    errorRealtimeUnavailable: t('ai.errorRealtimeUnavailable'),
    errorConnectionLost: t('ai.connectionLost'),
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: shouldSimplify ? 'auto' : 'smooth',
      });
    }
  }, [messages, isWaitingReply, isSending, shouldSimplify]);

  const panelClasses = isLgUp
    ? 'w-[400px] h-[550px] rounded-[2.5rem]'
    : 'inset-x-0 bottom-0 w-full h-[min(90dvh,600px)] rounded-t-[2rem] safe-bottom';

  const containerClasses = isLgUp
    ? 'flex flex-col items-end gap-4'
    : 'fixed inset-x-0 bottom-0 z-[100] flex flex-col items-end pointer-events-none';

  const launcherClasses = isLgUp
    ? 'pointer-events-auto'
    : 'pointer-events-auto fixed end-4 bottom-4 safe-bottom';

  if (isCoachPage) return null;

  return (
    <div className={containerClasses}>
      <AnimatePresence>
        {isOpen && !isLgUp && (
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[99] pointer-events-auto"
            onClick={() => setIsOpen(false)}
          />
        )}
        {isOpen && (
          <motion.div
            key="chat-panel"
            initial={isLgUp ? { opacity: 0, scale: 0.8, y: 40 } : { opacity: 0, y: '100%' }}
            animate={isLgUp ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }}
            exit={isLgUp ? { opacity: 0, scale: 0.8, y: 40 } : { opacity: 0, y: '100%' }}
            transition={shouldSimplify ? { duration: 0.2 } : weightedTransition}
            className={`glass-panel flex flex-col overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.5)] border-subtle pointer-events-auto z-[100] ${panelClasses} ${!isLgUp ? 'fixed' : ''}`}
          >
            <div className="p-4 sm:p-6 border-b border-subtle flex items-center justify-between bg-primary/10 backdrop-blur-3xl shrink-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined font-black text-xl">auto_awesome</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-sm tracking-tight text-foreground">{t('ai.widgetTitle')}</h3>
                  <CoachChatStatusBar
                    connectionState={connectionState}
                    streamPhase={streamPhase}
                    isSending={isSending}
                    compact
                  />
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="size-11 flex items-center justify-center rounded-xl hover:bg-elevated text-muted hover:text-foreground transition-colors shrink-0"
                aria-label={t('common.close')}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-hidden relative min-h-0">
              {isLgUp && (
                <div className="absolute inset-0 pointer-events-none opacity-5">
                  <ChatVisual />
                </div>
              )}

              <motion.div
                ref={scrollRef}
                className="h-full overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar relative z-10"
              >
                <motion.div
                  variants={staggerContainer(0.1)}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  <CoachChatThread
                    variant="widget"
                    messages={messages}
                    isLoading={isWaitingReply}
                    pendingConfirmIndex={pendingConfirmIndex}
                    pendingDisambiguationIndex={pendingDisambiguationIndex}
                    onConfirm={handleConfirmAction}
                    onCancel={handleCancelAction}
                    onPickFoodCandidate={handlePickFoodCandidate}
                    foodCandidateKey={foodCandidateKey}
                  />
                </motion.div>

                {isWaitingReply && messages[messages.length - 1]?.role !== 'ai' ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <motion.div className="bg-elevated px-4 py-3 rounded-2xl rounded-tl-none flex gap-1.5 items-center border border-subtle">
                      <CoachTypingDots size="sm" />
                    </motion.div>
                  </motion.div>
                ) : null}
              </motion.div>
            </div>

            <div className="p-4 sm:p-6 bg-elevated border-t border-subtle backdrop-blur-2xl shrink-0 safe-bottom">
              <CoachChatComposer
                variant="widget"
                hideStatusBar
                input={input}
                setInput={setInput}
                onSend={handleSend}
                onStop={handleStopStreaming}
                isSending={isSending}
                isWaitingReply={isWaitingReply}
                isStreamingTokens={isStreamingTokens}
                connectionState={connectionState}
                streamPhase={streamPhase}
                pendingConfirmIndex={pendingConfirmIndex}
                pendingDisambiguationIndex={pendingDisambiguationIndex}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
        <Magnetic strength={0.4}>
          <motion.button
            onClick={() => setIsOpen(true)}
            variants={buttonPress}
            whileHover="hover"
            whileTap="tap"
            className={`size-14 sm:size-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-500 relative group overflow-hidden bg-primary shadow-primary/40 ${launcherClasses}`}
            aria-label={t('nav.aiCoach')}
          >
            <motion.div
              animate={!shouldSimplify ? { scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] } : {}}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 bg-white opacity-0"
            />
            <span className="material-symbols-outlined text-3xl font-black text-foreground relative z-10">
              auto_awesome
            </span>
          </motion.button>
        </Magnetic>
      )}
    </div>
  );
};
