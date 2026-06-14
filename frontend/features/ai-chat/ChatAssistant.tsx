
import React, { useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionPrefs, snapTransition } from '../../lib/motion';
import { ChatVisual } from '../../3d/PageSpecificVisuals';
import { useAuthStore } from '../../store/useAuthStore';
import { useI18n } from '../../lib/i18n/useI18n';
import { useBreakpoint } from '../../lib/hooks/useBreakpoint';
import { CoachChatThread } from './CoachChatThread';
import { useCoachChat } from './useCoachChat';
import { CoachChatComposer } from './CoachChatComposer';
import { CoachTypingDots } from './CoachTypingDots';

/** Full-page coach chat — same behavior as ChatWidget (shared useCoachChat hook). */
export const ChatAssistant: React.FC = () => {
  const { shouldSimplify } = useMotionPrefs();
  const { isLgUp } = useBreakpoint();
  const { t, language, dir, isRtl } = useI18n();
  const userName = useAuthStore((s) => s.user?.profile?.displayName || s.user?.email?.split('@')[0] || 'athlete');
  const greeting = useMemo(() => t('ai.greetingPersonalized', { name: userName }), [t, userName, language]);
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
    greeting,
    locale: language,
    loadHistory: true,
    preWarmWs: true,
    errorNetwork: t('ai.errorNetwork'),
    errorTimeout: t('ai.errorConnection'),
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

  return (
    <motion.div
      dir={dir}
      className="flex flex-1 flex-col min-h-0 w-full min-w-0 max-w-5xl mx-auto relative"
    >
      {isLgUp && (
        <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full pointer-events-none opacity-10">
          <ChatVisual />
        </motion.div>
      )}

      <motion.div
        ref={scrollRef}
        className="flex flex-col flex-1 overflow-y-auto min-h-0 space-y-6 sm:space-y-8 px-2 sm:px-4 custom-scrollbar relative z-10 pb-4"
      >
        <AnimatePresence initial={false}>
          <CoachChatThread
            variant="page"
            isRtl={isRtl}
            messages={messages}
            isLoading={isWaitingReply}
            pendingConfirmIndex={pendingConfirmIndex}
            pendingDisambiguationIndex={pendingDisambiguationIndex}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
            onPickFoodCandidate={handlePickFoodCandidate}
            foodCandidateKey={foodCandidateKey}
          />
        </AnimatePresence>

        {isWaitingReply && messages[messages.length - 1]?.role !== 'ai' ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <motion.div className="bg-elevated p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] rounded-tl-none flex gap-3 items-center border border-border/50">
              <CoachTypingDots size="md" />
            </motion.div>
          </motion.div>
        ) : null}
      </motion.div>

      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={snapTransition}
        className="bg-surface/80 backdrop-blur-2xl border border-border p-3 sm:p-5 rounded-2xl sm:rounded-[2.5rem] flex flex-col gap-2 shadow-2xl relative z-20 shrink-0 safe-bottom"
      >
        <CoachChatComposer
          variant="page"
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
      </motion.div>
    </motion.div>
  );
};
