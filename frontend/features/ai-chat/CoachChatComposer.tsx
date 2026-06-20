import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

import { buttonPress } from '../../lib/motion';
import { Magnetic } from '../../components/shared/MotionWrappers';
import { useI18n } from '../../lib/i18n/useI18n';
import type { RealtimeConnectionState } from '../../lib/realtime/useRealtimeStore';

import { CoachChatStatusBar } from './CoachChatStatusBar';

export interface CoachChatComposerProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isSending: boolean;
  isWaitingReply: boolean;
  isStreamingTokens: boolean;
  connectionState: RealtimeConnectionState;
  streamPhase: string | null;
  pendingConfirmIndex: number | null;
  pendingDisambiguationIndex: number | null;
  variant?: 'widget' | 'page';
  hideStatusBar?: boolean;
}

const MAX_TEXTAREA_HEIGHT_PX = 220;

export function CoachChatComposer({
  input,
  setInput,
  onSend,
  onStop,
  isSending,
  isWaitingReply,
  isStreamingTokens,
  connectionState,
  streamPhase,
  pendingConfirmIndex,
  pendingDisambiguationIndex,
  variant = 'widget',
  hideStatusBar = false,
}: CoachChatComposerProps) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isPage = variant === 'page';
  const isStreamActive = isWaitingReply || isStreamingTokens;
  const canSend =
    connectionState === 'open' &&
    !isStreamActive &&
    Boolean(input.trim()) &&
    pendingConfirmIndex == null &&
    pendingDisambiguationIndex == null;
  const inputDisabled =
    connectionState !== 'open' ||
    isWaitingReply ||
    pendingConfirmIndex != null ||
    pendingDisambiguationIndex != null;
  const showStop = isStreamingTokens && typeof onStop === 'function';

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }, [input]);

  const textareaClass = isPage
    ? 'flex-1 min-h-[2.75rem] max-h-[220px] resize-none overflow-y-auto bg-transparent border-none focus:outline-none text-base sm:text-xl font-bold text-foreground placeholder:text-slate-600 disabled:opacity-50 text-start leading-relaxed py-2'
    : 'flex-1 min-h-[2.75rem] max-h-[220px] resize-none overflow-y-auto bg-elevated border border-subtle rounded-xl px-4 py-3 text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all font-bold placeholder:text-slate-600 disabled:opacity-50 leading-relaxed';

  return (
    <div className={isPage ? 'flex flex-col gap-2' : 'flex flex-col gap-2'}>
      {!hideStatusBar ? (
        <CoachChatStatusBar
          connectionState={connectionState}
          streamPhase={streamPhase}
          isSending={isSending}
          compact={!isPage}
        />
      ) : null}
      {pendingDisambiguationIndex != null ? (
        <p className={`${isPage ? 'text-xs' : 'text-[11px]'} font-medium text-muted px-1`}>
          {t('ai.pendingDisambiguationHint')}
        </p>
      ) : pendingConfirmIndex != null ? (
        <p className={`${isPage ? 'text-xs' : 'text-[11px]'} font-medium text-muted px-1`}>
          {t('ai.pendingConfirmHint')}
        </p>
      ) : null}
      <div className={`flex items-end ${isPage ? 'gap-3 sm:gap-6' : 'gap-3'}`}>
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          dir="auto"
          disabled={inputDisabled}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey) return;
            if (pendingConfirmIndex != null || pendingDisambiguationIndex != null || !canSend) return;
            e.preventDefault();
            onSend();
          }}
          placeholder={
            connectionState !== 'open'
              ? t('ai.connection.offlinePlaceholder')
              : isWaitingReply
                ? t('ai.thinking')
                : isPage
                  ? t('ai.placeholder')
                  : t('ai.widgetPlaceholder')
          }
          className={textareaClass}
          aria-label={isPage ? t('ai.placeholder') : t('ai.widgetPlaceholder')}
        />
        {showStop ? (
          <Magnetic strength={isPage ? 0.4 : 0.2}>
            <motion.button
              type="button"
              variants={buttonPress}
              whileHover="hover"
              whileTap="tap"
              onClick={onStop}
              aria-label={t('ai.stopStreaming')}
              className={`${isPage ? 'size-11 sm:size-14 rounded-xl sm:rounded-2xl' : 'size-11 rounded-xl'} bg-elevated border border-subtle text-foreground flex items-center justify-center shrink-0`}
            >
              <span className={`material-symbols-outlined font-black ${isPage ? 'text-2xl sm:text-3xl' : ''}`} aria-hidden>
                stop
              </span>
            </motion.button>
          </Magnetic>
        ) : null}
        <Magnetic strength={isPage ? 0.4 : 0.2}>
          <motion.button
            type="button"
            variants={buttonPress}
            whileHover="hover"
            whileTap="tap"
            onClick={onSend}
            aria-label={t('ai.send')}
            disabled={!canSend}
            className={`${isPage ? 'size-11 sm:size-14 rounded-xl sm:rounded-2xl shadow-2xl shadow-primary/40' : 'size-11 rounded-xl shadow-lg shadow-primary/30'} bg-primary text-white flex items-center justify-center disabled:opacity-50 shrink-0`}
          >
            <span
              className={`material-symbols-outlined font-black ${isPage ? 'text-2xl sm:text-3xl' : ''}`}
              aria-hidden
            >
              send
            </span>
          </motion.button>
        </Magnetic>
      </div>
    </div>
  );
}
