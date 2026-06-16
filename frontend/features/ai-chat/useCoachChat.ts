import { useCallback, useEffect, useRef, useState } from 'react';

import aiService, { type AiChatResponse, type AiFoodDisambiguationCandidate } from '../../services/aiService';
import { useCoachRealtimeSend } from '../../lib/realtime/useCoachRealtimeSend';
import { ensureRealtimeReady, useRealtimeStore } from '../../lib/realtime/useRealtimeStore';

import { emitDashboardRefresh } from '../dashboard/wellnessWidgets';

import {

  persistCoachConversationId,

  readCoachConversationId,

} from './coachChatConstants';

import type { CoachActionErrorDetails, CoachChatMessage } from './coachChatTypes';



/**

 * Chat history contract (client):

 * - Persist `conversationId` in localStorage (`taqwin.coach.conversationId`).

 * - Coach turns stream over WebSocket only (no REST chat fallback).

 * - Confirm/cancel/disambiguate use WS coach.confirm / coach.cancelPending / coach.disambiguate.
 * - Confirm falls back to REST when WebSocket is unavailable (includes step-up phrase/password).

 */



function foodCandidateKey(candidate: AiFoodDisambiguationCandidate): string {

  return candidate.foodItemId || `webteb:${candidate.webtebId}`;

}



function stepUpFieldsFromData(data: Partial<AiChatResponse> | CoachActionErrorDetails | undefined) {
  if (!data) return {};
  return {
    stepUpRequired: data.stepUpRequired,
    stepUpEligible: data.stepUpEligible,
    stepUpPhrase: data.stepUpPhrase,
    stepUpMethods: data.stepUpMethods,
    stepUpIdleMs: data.stepUpIdleMs,
    pendingCreatedAt: data.pendingCreatedAt,
    stepUpStaleAt: data.stepUpStaleAt,
  };
}

function mapAssistantMetaToMessage(

  content: string,

  meta: CoachChatMessage | Record<string, unknown> | undefined,

): CoachChatMessage {

  const m = meta || {};

  return {

    role: 'ai',

    text: content,

    confirmationRequired: Boolean(m.confirmationRequired),

    confirmationPreview:

      typeof m.confirmationPreview === 'string' ? m.confirmationPreview : null,

    disambiguationRequired: Boolean(m.disambiguationRequired),

    disambiguationKind:
      m.disambiguationKind === 'food' || m.disambiguationRequired ? 'food' : undefined,

    candidates: Array.isArray(m.candidates) ? m.candidates : undefined,

    disambiguationQuery:

      typeof m.disambiguationQuery === 'string' ? m.disambiguationQuery : undefined,

    disambiguationExpired: Boolean(m.disambiguationExpired),

    actionId: typeof m.actionId === 'string' ? m.actionId : null,

    stepUpRequired: Boolean(m.stepUpRequired),

    stepUpEligible: Boolean(m.stepUpEligible),

    stepUpPhrase: typeof m.stepUpPhrase === 'string' ? m.stepUpPhrase : null,

    stepUpMethods: Array.isArray(m.stepUpMethods) ? m.stepUpMethods : undefined,

    stepUpIdleMs: typeof m.stepUpIdleMs === 'number' ? m.stepUpIdleMs : undefined,

    pendingCreatedAt: typeof m.pendingCreatedAt === 'string' ? m.pendingCreatedAt : null,

    stepUpStaleAt: typeof m.stepUpStaleAt === 'string' ? m.stepUpStaleAt : null,

    stepUpConfirmError: null,

    toolCalls: Array.isArray(m.toolCalls) ? m.toolCalls : undefined,

  };

}

interface UseCoachChatOptions {
  greeting: string;

  locale: 'en' | 'ar';

  /** Load persisted thread from API on mount (full-page chat). */

  loadHistory?: boolean;

  errorNetwork?: string;

  errorTimeout?: string;

  errorRealtimeUnavailable?: string;

  /** Connect WebSocket when the chat surface is visible (widget open / full page). */
  preWarmWs?: boolean;

  /** Shown when the live connection drops mid-turn. */
  errorConnectionLost?: string;

}



export function useCoachChat({

  greeting,

  locale,

  loadHistory = false,

  errorNetwork = 'Network error',

  errorTimeout = 'Request failed',

  errorRealtimeUnavailable = 'Live coach connection is unavailable. Refresh the page.',

  preWarmWs = false,

  errorConnectionLost = 'Connection lost. Your reply may still have been saved — refresh to check.',

}: UseCoachChatOptions) {

  const [conversationId, setConversationId] = useState<string | undefined>(readCoachConversationId);

  const [messages, setMessages] = useState<CoachChatMessage[]>([{ role: 'ai', text: greeting }]);

  const [input, setInput] = useState('');

  /** Waiting for first streamed token (shows "thinking" — not post-stream DB save). */
  const [isWaitingReply, setIsWaitingReply] = useState(false);
  /** Turn in flight until coach.done — blocks send, not typing. */
  const [isSending, setIsSending] = useState(false);

  const [pendingConfirmIndex, setPendingConfirmIndex] = useState<number | null>(null);

  const [pendingDisambiguationIndex, setPendingDisambiguationIndex] = useState<number | null>(null);

  const [streamPhase, setStreamPhase] = useState<string | null>(null);
  const [isStreamingTokens, setIsStreamingTokens] = useState(false);

  const connectionState = useRealtimeStore((s) => s.connectionState);

  const historyLoaded = useRef(false);
  const {
    sendCoachMessage,
    sendCoachConfirm,
    sendCoachCancelPending,
    sendCoachDisambiguate,
    cancelCoachMessage,
  } = useCoachRealtimeSend();
  const streamingAiIndexRef = useRef<number | null>(null);
  const streamTokenBufferRef = useRef('');
  const streamFlushScheduledRef = useRef(false);
  const turnFinalizeResolverRef = useRef<(() => void) | null>(null);
  const turnFinalizePromiseRef = useRef<Promise<void> | null>(null);

  const beginTurnFinalize = useCallback(() => {
    if (turnFinalizePromiseRef.current) return;
    turnFinalizePromiseRef.current = new Promise<void>((resolve) => {
      turnFinalizeResolverRef.current = resolve;
    });
  }, []);

  const resolveTurnFinalize = useCallback(() => {
    turnFinalizeResolverRef.current?.();
    turnFinalizeResolverRef.current = null;
    turnFinalizePromiseRef.current = null;
  }, []);

  const waitForTurnFinalize = useCallback(async () => {
    const pending = turnFinalizePromiseRef.current;
    if (!pending) return;
    await Promise.race([
      pending,
      new Promise<void>((resolve) => window.setTimeout(resolve, 8_000)),
    ]);
  }, []);

  /** Reply is visible — unlock composer; persist may still run until coach.done. */
  const releaseComposerAfterStream = useCallback(() => {
    setIsWaitingReply(false);
    setIsStreamingTokens(false);
    setStreamPhase(null);
  }, []);

  const handleStreamPhase = useCallback(
    (phase: string) => {
      setStreamPhase(phase || null);
      if (phase === 'saving') {
        releaseComposerAfterStream();
        beginTurnFinalize();
      }
    },
    [beginTurnFinalize, releaseComposerAfterStream],
  );

  const flushStreamTokens = useCallback(() => {
    streamFlushScheduledRef.current = false;
    const buf = streamTokenBufferRef.current;
    if (!buf) return;
    streamTokenBufferRef.current = '';
    const idx = streamingAiIndexRef.current;
    if (idx == null) return;
    setMessages((prev) => {
      const next = [...prev];
      const msg = next[idx];
      if (msg?.role === 'ai') next[idx] = { ...msg, text: msg.text + buf };
      return next;
    });
  }, []);

  const scheduleStreamFlush = useCallback(() => {
    if (streamFlushScheduledRef.current) return;
    streamFlushScheduledRef.current = true;
    requestAnimationFrame(() => flushStreamTokens());
  }, [flushStreamTokens]);

  useEffect(() => {
    if (!isSending) return;
    const timer = window.setTimeout(() => {
      setIsSending(false);
      setIsWaitingReply(false);
      setIsStreamingTokens(false);
      setStreamPhase(null);
      streamingAiIndexRef.current = null;
    }, 120_000);
    return () => window.clearTimeout(timer);
  }, [isSending]);

  useEffect(() => {
    if (!preWarmWs) return;
    void ensureRealtimeReady();
  }, [preWarmWs]);

  useEffect(() => {
    if (!isSending || connectionState === 'open' || connectionState === 'connecting') return;

    const idx = streamingAiIndexRef.current;
    streamingAiIndexRef.current = null;
    setIsSending(false);
    setIsWaitingReply(false);
    setIsStreamingTokens(false);
    setStreamPhase(null);

    setMessages((prev) => {
      const partial = idx != null ? prev[idx]?.text?.trim() : '';
      if (partial) return prev;
      if (idx != null && prev[idx]?.role === 'ai' && !prev[idx].text) {
        const next = [...prev];
        next[idx] = { role: 'ai', text: errorConnectionLost };
        return next;
      }
      return [...prev, { role: 'ai', text: errorConnectionLost }];
    });
  }, [connectionState, errorConnectionLost, isSending]);

  useEffect(() => {

    setMessages((prev) => {

      if (prev.length === 1 && prev[0].role === 'ai') {

        return [{ role: 'ai', text: greeting }];

      }

      return prev;

    });

  }, [greeting]);



  const syncPendingIndices = useCallback((next: CoachChatMessage[]) => {

    let confirmIdx: number | null = null;

    let disambigIdx: number | null = null;

    for (let i = next.length - 1; i >= 0; i -= 1) {

      const msg = next[i];

      if (msg.role !== 'ai') continue;

      if (disambigIdx == null && msg.disambiguationRequired && !msg.disambiguationExpired) {

        disambigIdx = i;

      }

      if (confirmIdx == null && msg.confirmationRequired) {

        confirmIdx = i;

      }

      if (confirmIdx != null && disambigIdx != null) break;

    }

    setPendingConfirmIndex(confirmIdx);

    setPendingDisambiguationIndex(disambigIdx);

  }, []);



  useEffect(() => {

    if (!loadHistory || !conversationId || historyLoaded.current) return;

    historyLoaded.current = true;

    let cancelled = false;



    void (async () => {

      const res = await aiService.getConversationMessages(conversationId).catch(() => null);

      if (cancelled || !res || res.error || !res.data?.messages?.length) return;



      const loaded: CoachChatMessage[] = res.data.messages

        .filter((m) => m.role === 'user' || m.role === 'assistant')

        .map((m) => {

          if (m.role === 'assistant') {

            return mapAssistantMetaToMessage(m.content, m.meta);

          }

          return { role: 'user' as const, text: m.content };

        });



      const pendingRes = await aiService.getChatPending(conversationId).catch(() => null);

      const pending = pendingRes?.data?.pending;



      if (pending && loaded.length) {
        let targetIdx = -1;
        for (let i = loaded.length - 1; i >= 0; i -= 1) {
          const msg = loaded[i];
          if (msg.role !== 'ai') continue;
          if (pending.actionId && msg.actionId === pending.actionId) {
            targetIdx = i;
            break;
          }
          if (targetIdx === -1) targetIdx = i;
        }
        if (targetIdx >= 0) {
          const msg = loaded[targetIdx];
          if (pending.disambiguationRequired) {
            loaded[targetIdx] = {
              ...msg,
              disambiguationRequired: true,
              disambiguationKind: 'food',
              candidates: pending.candidates || msg.candidates,
              disambiguationQuery: pending.disambiguationQuery || msg.disambiguationQuery,
              disambiguationExpired: false,
              confirmationRequired: false,
              actionId: pending.actionId,
            };
          } else if (pending.confirmationRequired) {
            loaded[targetIdx] = {
              ...msg,
              confirmationRequired: true,
              confirmationPreview: pending.confirmationPreview || msg.confirmationPreview,
              disambiguationRequired: false,
              actionId: pending.actionId,
              stepUpRequired: pending.stepUpRequired,
              stepUpEligible: pending.stepUpEligible,
              stepUpPhrase: pending.stepUpPhrase,
              stepUpMethods: pending.stepUpMethods,
              stepUpIdleMs: pending.stepUpIdleMs,
              pendingCreatedAt: pending.pendingCreatedAt,
              stepUpStaleAt: pending.stepUpStaleAt,
              toolCalls: msg.toolCalls,
            };
          }
        }
      } else if (loaded.length) {

        for (let i = loaded.length - 1; i >= 0; i -= 1) {

          const msg = loaded[i];

          if (msg.role === 'ai' && msg.disambiguationRequired && msg.candidates?.length) {

            loaded[i] = { ...msg, disambiguationExpired: true };

            break;

          }

        }

      }



      if (loaded.length) {

        const next = [{ role: 'ai' as const, text: greeting }, ...loaded];

        setMessages(next);

        syncPendingIndices(next);

      }

    })();



    return () => {

      cancelled = true;

    };

  }, [loadHistory, conversationId, greeting, syncPendingIndices]);



  const applyChatResponse = useCallback(

    (

      res: Awaited<ReturnType<typeof aiService.chat>>,

      opts: { afterConfirm?: boolean; errorFallback?: string; replaceIndex?: number | null } = {},

    ) => {

      const fallback = opts.errorFallback || errorTimeout;



      if (res.error) {

        setMessages((prev) => [...prev, { role: 'ai', text: res.error || fallback }]);

        setPendingConfirmIndex(null);

        setPendingDisambiguationIndex(null);

        return;

      }



      const data = res.data;

      if (data?.conversationId) {

        setConversationId(data.conversationId);

        persistCoachConversationId(data.conversationId);

      }



      setMessages((prev) => {

        const replaceIdx = opts.replaceIndex;
        const streamedText =
          replaceIdx != null && replaceIdx >= 0 ? prev[replaceIdx]?.text : undefined;
        const finalReply = data?.reply || fallback;
        const keepStreamedText =
          typeof streamedText === 'string' &&
          streamedText.length > 0 &&
          (streamedText.trim() === finalReply.trim() ||
            (finalReply.trim().length > 0 && streamedText.trim().startsWith(finalReply.trim())));

        const aiMessage: CoachChatMessage = {

          role: 'ai',

          text: keepStreamedText ? streamedText : finalReply,

          confirmationRequired: data?.confirmationRequired,

          confirmationPreview: data?.confirmationPreview,

          stepUpRequired: data?.stepUpRequired,

          stepUpEligible: data?.stepUpEligible,

          stepUpPhrase: data?.stepUpPhrase,

          stepUpMethods: data?.stepUpMethods,

          stepUpIdleMs: data?.stepUpIdleMs,

          pendingCreatedAt: data?.pendingCreatedAt,

          stepUpStaleAt: data?.stepUpStaleAt,

          stepUpConfirmError: null,

          disambiguationRequired: data?.disambiguationRequired,

          disambiguationKind: data?.disambiguationKind === 'food' ? 'food' : undefined,

          candidates: data?.candidates,

          disambiguationQuery: data?.disambiguationQuery,

          actionId: data?.actionId,

          toolCalls: data?.toolCalls,

        };

        let next: CoachChatMessage[];
        if (replaceIdx != null && replaceIdx >= 0 && replaceIdx < prev.length) {
          next = [...prev];
          next[replaceIdx] = aiMessage;
        } else {
          next = [...prev, aiMessage];
        }
        syncPendingIndices(next);

        return next;

      });



      if (opts.afterConfirm && !data?.confirmationRequired && !data?.disambiguationRequired) {

        emitDashboardRefresh();

      }

    },

    [errorTimeout, syncPendingIndices],

  );

  const buildStreamTurnCallbacks = useCallback(
    (opts: { afterConfirm?: boolean; errorFallback?: string } = {}) => ({
      onPhase: handleStreamPhase,
      onToken: (delta: string) => {
        setIsWaitingReply(false);
        if (!delta || streamingAiIndexRef.current == null) return;
        streamTokenBufferRef.current += delta;
        scheduleStreamFlush();
      },
      onDone: (data: AiChatResponse & { afterConfirm?: boolean; turnId?: string }) => {
        resolveTurnFinalize();
        flushStreamTokens();
        const idx = streamingAiIndexRef.current;
        streamingAiIndexRef.current = null;
        releaseComposerAfterStream();
        applyChatResponse(
          { data: { ...data, reply: data?.reply || '' } },
          {
            afterConfirm: Boolean(opts.afterConfirm ?? data?.afterConfirm),
            errorFallback: opts.errorFallback || errorTimeout,
            replaceIndex: idx,
          },
        );
        setIsSending(false);
        setIsWaitingReply(false);
      },
      onError: (message: string) => {
        resolveTurnFinalize();
        flushStreamTokens();
        const idx = streamingAiIndexRef.current;
        streamingAiIndexRef.current = null;
        releaseComposerAfterStream();
        const fallback = message || opts.errorFallback || errorTimeout;
        if (idx != null) {
          setMessages((prev) => {
            const next = [...prev];
            if (next[idx]?.role === 'ai') {
              next[idx] = { role: 'ai', text: fallback };
            }
            return next;
          });
        } else {
          setMessages((prev) => [...prev, { role: 'ai', text: fallback }]);
        }
        setIsSending(false);
        setIsWaitingReply(false);
      },
    }),
    [
      applyChatResponse,
      errorTimeout,
      flushStreamTokens,
      handleStreamPhase,
      releaseComposerAfterStream,
      resolveTurnFinalize,
      scheduleStreamFlush,
    ],
  );

  const beginStreamingAssistantBubble = useCallback(() => {
    streamingAiIndexRef.current = null;
    streamTokenBufferRef.current = '';
    streamFlushScheduledRef.current = false;
    setIsStreamingTokens(true);
    setStreamPhase('starting');
    setIsWaitingReply(true);
    setMessages((prev) => {
      const next = [...prev, { role: 'ai' as const, text: '' }];
      streamingAiIndexRef.current = next.length - 1;
      return next;
    });
  }, []);

  const showRealtimeUnavailable = useCallback(
    (streamIdx: number | null) => {
      resolveTurnFinalize();
      streamingAiIndexRef.current = null;
      setMessages((prev) => {
        if (
          streamIdx != null &&
          streamIdx < prev.length &&
          prev[streamIdx]?.role === 'ai' &&
          !prev[streamIdx].text
        ) {
          const next = [...prev];
          next[streamIdx] = { role: 'ai', text: errorRealtimeUnavailable };
          return next;
        }
        return [...prev, { role: 'ai', text: errorRealtimeUnavailable }];
      });
      setIsSending(false);
      setIsWaitingReply(false);
      releaseComposerAfterStream();
    },
    [errorRealtimeUnavailable, releaseComposerAfterStream, resolveTurnFinalize],
  );

  const sendMessage = useCallback(

    async (text: string) => {

      const trimmed = text.trim();

      if (!trimmed || isWaitingReply || isStreamingTokens) return;

      await waitForTurnFinalize();

      if (isWaitingReply || isStreamingTokens) return;

      setMessages((prev) => [...prev, { role: 'user', text: trimmed }]);

      setInput('');

      setIsSending(true);
      setIsWaitingReply(true);
      setIsStreamingTokens(true);
      setStreamPhase('starting');

      setPendingConfirmIndex(null);

      setPendingDisambiguationIndex(null);

      streamTokenBufferRef.current = '';
      streamFlushScheduledRef.current = false;

      setMessages((prev) => {
        const next = [...prev, { role: 'ai' as const, text: '' }];
        streamingAiIndexRef.current = next.length - 1;
        return next;
      });

      const usedWs = await sendCoachMessage(
        { text: trimmed, locale, conversationId },
        {
          ...buildStreamTurnCallbacks({ errorFallback: errorTimeout }),
          onCancelled: () => {
            resolveTurnFinalize();
            flushStreamTokens();
            streamingAiIndexRef.current = null;
            releaseComposerAfterStream();
            setIsSending(false);
            setIsWaitingReply(false);
          },
        },
      );

      if (!usedWs) {
        showRealtimeUnavailable(streamingAiIndexRef.current);
      }
    },

    [
      buildStreamTurnCallbacks,
      conversationId,
      errorTimeout,
      isStreamingTokens,
      isWaitingReply,
      locale,
      flushStreamTokens,
      releaseComposerAfterStream,
      resolveTurnFinalize,
      sendCoachMessage,
      showRealtimeUnavailable,
      waitForTurnFinalize,
    ],

  );



  const handleSend = useCallback(() => {

    void sendMessage(input);

  }, [input, sendMessage]);

  const handleStopStreaming = useCallback(() => {
    if (!isStreamingTokens) return;
    cancelCoachMessage();
  }, [cancelCoachMessage, isStreamingTokens]);



  const handleConfirmAction = useCallback(async (stepUp?: { confirmationPhrase?: string; password?: string }) => {

    if (isSending || pendingConfirmIndex == null) return;

    const pendingIdx = pendingConfirmIndex;
    const pendingMsg = messages[pendingIdx];

    const actionId = pendingMsg?.actionId;

    if (!actionId) {

      setMessages((prev) => [...prev, { role: 'ai', text: errorTimeout }]);

      return;

    }

    setMessages((prev) => {
      if (pendingIdx < 0 || pendingIdx >= prev.length) return prev;
      const next = [...prev];
      next[pendingIdx] = { ...next[pendingIdx], stepUpConfirmError: null };
      return next;
    });

    setIsSending(true);
    beginStreamingAssistantBubble();

    const confirmPayload = {
      actionId,
      locale,
      conversationId,
      confirmationPhrase: stepUp?.confirmationPhrase,
      password: stepUp?.password,
    };

    const handleStepUpConfirmError = (message: string, details?: Record<string, unknown>) => {
      resolveTurnFinalize();
      flushStreamTokens();
      const streamIdx = streamingAiIndexRef.current;
      streamingAiIndexRef.current = null;
      releaseComposerAfterStream();
      setIsSending(false);
      setIsWaitingReply(false);

      const code = typeof details?.code === 'string' ? details.code : '';
      const isStepUpError = code.startsWith('STEP_UP');

      setMessages((prev) => {
        let next = [...prev];
        if (streamIdx != null && streamIdx < next.length && next[streamIdx]?.role === 'ai') {
          if (!next[streamIdx].text?.trim()) {
            next = next.filter((_, i) => i !== streamIdx);
          } else {
            next[streamIdx] = { role: 'ai', text: message || errorTimeout };
          }
        } else if (!isStepUpError) {
          next = [...next, { role: 'ai', text: message || errorTimeout }];
        }

        const idx = next.findIndex((m, i) => i === pendingIdx || m.actionId === actionId);
        if (isStepUpError && idx >= 0) {
          next[idx] = {
            ...next[idx],
            stepUpConfirmError: message || errorTimeout,
            ...stepUpFieldsFromData(details as CoachActionErrorDetails),
          };
        }
        syncPendingIndices(next);
        return next;
      });
    };

    const confirmCallbacks = {
      onPhase: handleStreamPhase,
      onToken: (delta: string) => {
        setIsWaitingReply(false);
        if (!delta || streamingAiIndexRef.current == null) return;
        streamTokenBufferRef.current += delta;
        scheduleStreamFlush();
      },
      onDone: (data: AiChatResponse & { afterConfirm?: boolean }) => {
        resolveTurnFinalize();
        flushStreamTokens();
        const idx = streamingAiIndexRef.current;
        streamingAiIndexRef.current = null;
        releaseComposerAfterStream();
        applyChatResponse(
          { data: { ...data, reply: data?.reply || '' } },
          {
            afterConfirm: true,
            errorFallback: errorTimeout,
            replaceIndex: idx,
          },
        );
        setIsSending(false);
        setIsWaitingReply(false);
      },
      onError: handleStepUpConfirmError,
    };

    const usedWs = await sendCoachConfirm(confirmPayload, confirmCallbacks);
    if (!usedWs) {
      resolveTurnFinalize();
      flushStreamTokens();
      streamingAiIndexRef.current = null;
      releaseComposerAfterStream();

      const res = await aiService.confirmChatAction(actionId, confirmPayload);
      if (res.error || !res.data) {
        handleStepUpConfirmError(res.error || errorTimeout, {
          code: res.code,
          ...stepUpFieldsFromData(res),
        });
        return;
      }
      applyChatResponse(res, { afterConfirm: true, errorFallback: errorTimeout });
      setIsSending(false);
      setIsWaitingReply(false);
    }
  }, [
    applyChatResponse,
    beginStreamingAssistantBubble,
    conversationId,
    errorTimeout,
    flushStreamTokens,
    handleStreamPhase,
    isSending,
    locale,
    messages,
    pendingConfirmIndex,
    releaseComposerAfterStream,
    resolveTurnFinalize,
    scheduleStreamFlush,
    sendCoachConfirm,
    syncPendingIndices,
  ]);



  const handleCancelAction = useCallback(async () => {
    const pendingIdx = pendingConfirmIndex ?? pendingDisambiguationIndex;
    if (isSending || pendingIdx == null) return;
    const pendingMsg = messages[pendingIdx];
    const actionId = pendingMsg?.actionId;
    if (!actionId) {
      setPendingConfirmIndex(null);
      setPendingDisambiguationIndex(null);
      return;
    }

    setPendingConfirmIndex(null);
    setPendingDisambiguationIndex(null);
    setIsSending(true);
    beginStreamingAssistantBubble();

    const usedWs = await sendCoachCancelPending(
      { actionId, locale, conversationId },
      buildStreamTurnCallbacks({ errorFallback: errorTimeout }),
    );
    if (!usedWs) {
      showRealtimeUnavailable(streamingAiIndexRef.current);
    }
  }, [
    beginStreamingAssistantBubble,
    buildStreamTurnCallbacks,
    conversationId,
    errorRealtimeUnavailable,
    errorTimeout,
    isSending,
    locale,
    messages,
    pendingConfirmIndex,
    pendingDisambiguationIndex,
    sendCoachCancelPending,
    showRealtimeUnavailable,
  ]);



  const handlePickFoodCandidate = useCallback(

    async (candidate: AiFoodDisambiguationCandidate) => {

      if (isSending || pendingDisambiguationIndex == null) return;

      const pendingMsg = messages[pendingDisambiguationIndex];

      const actionId = pendingMsg?.actionId;

      if (!actionId) {

        setMessages((prev) => [...prev, { role: 'ai', text: errorTimeout }]);

        return;

      }



      setIsSending(true);
      setPendingDisambiguationIndex(null);
      beginStreamingAssistantBubble();

      const usedWs = await sendCoachDisambiguate(
        {
          actionId,
          foodItemId: candidate.foodItemId,
          webtebId: candidate.webtebId,
          locale,
          conversationId,
        },
        buildStreamTurnCallbacks({ errorFallback: errorTimeout }),
      );
      if (!usedWs) {
        showRealtimeUnavailable(streamingAiIndexRef.current);
      }
    },
    [
      beginStreamingAssistantBubble,
      buildStreamTurnCallbacks,
      conversationId,
      errorRealtimeUnavailable,
      errorTimeout,
      isSending,
      locale,
      messages,
      pendingDisambiguationIndex,
      sendCoachDisambiguate,
      showRealtimeUnavailable,
    ],

  );



  return {

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

    conversationId,

    handleSend,

    handleStopStreaming,

    handleConfirmAction,

    handleCancelAction,

    handlePickFoodCandidate,

    foodCandidateKey,

    sendMessage,

  };

}


