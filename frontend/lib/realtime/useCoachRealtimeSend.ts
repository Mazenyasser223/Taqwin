import { useCallback, useRef } from 'react';

import type { AiChatResponse } from '../../services/aiService';

import {

  useRealtimeStore,

  isRealtimeOpen,

  ensureRealtimeReady,

  type RealtimeEnvelope,

} from './useRealtimeStore';



export type CoachStreamCallbacks = {

  onStarted?: (turnId: string) => void;

  onPhase?: (phase: string) => void;

  onToken?: (delta: string) => void;

  onDone?: (data: AiChatResponse & { turnId?: string; afterConfirm?: boolean }) => void;

  onError?: (message: string, details?: Record<string, unknown>) => void;

  onCancelled?: () => void;

};



type CoachActionPayload = Record<string, unknown>;



function subscribeCoachResponse(

  subscribe: (type: string, handler: (env: RealtimeEnvelope) => void) => () => void,

  callbacks: Pick<CoachStreamCallbacks, 'onDone' | 'onError'>,

  matchTurn?: (env: RealtimeEnvelope) => boolean,

) {

  const unsubscribers: Array<() => void> = [];

  const cleanup = () => {

    for (const u of unsubscribers) u();

  };



  unsubscribers.push(

    subscribe('coach.done', (env) => {

      if (matchTurn && !matchTurn(env)) return;

      cleanup();

      callbacks.onDone?.(env as unknown as AiChatResponse & { turnId?: string; afterConfirm?: boolean });

    }),

  );

  unsubscribers.push(

    subscribe('coach.error', (env) => {

      if (matchTurn && env.turnId && !matchTurn(env)) return;

      cleanup();

      callbacks.onError?.(String(env.message || 'Coach error'));

    }),

  );



  return cleanup;

}



/**

 * Coach chat transport is WebSocket-only (no REST fallback).

 */

export function useCoachRealtimeSend() {

  const send = useRealtimeStore((s) => s.send);

  const subscribe = useRealtimeStore((s) => s.subscribe);

  const activeTurnRef = useRef<string | null>(null);



  const sendCoachMessage = useCallback(

    async (

      payload: {

        text: string;

        locale?: 'en' | 'ar';

        conversationId?: string;

        turnId?: string;

      },

      callbacks: CoachStreamCallbacks,

    ): Promise<boolean> => {

      const ready = await ensureRealtimeReady();

      if (!ready) return false;



      const turnId = payload.turnId || `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      activeTurnRef.current = turnId;



      const matchTurn = (env: RealtimeEnvelope) => !env.turnId || env.turnId === turnId;



      const unsubscribers: Array<() => void> = [];

      const cleanup = () => {

        for (const u of unsubscribers) u();

      };



      unsubscribers.push(

        subscribe('coach.started', (env) => {

          if (!matchTurn(env)) return;

          callbacks.onStarted?.(turnId);

        }),

      );

      unsubscribers.push(

        subscribe('coach.phase', (env) => {

          if (!matchTurn(env)) return;

          callbacks.onPhase?.(String(env.phase || ''));

        }),

      );

      unsubscribers.push(

        subscribe('coach.token', (env) => {

          if (!matchTurn(env)) return;

          callbacks.onToken?.(String(env.delta || ''));

        }),

      );

      unsubscribers.push(

        subscribe('coach.done', (env) => {

          if (!matchTurn(env)) return;

          cleanup();

          activeTurnRef.current = null;

          callbacks.onDone?.(env as unknown as AiChatResponse & { turnId?: string });

        }),

      );

      unsubscribers.push(

        subscribe('coach.error', (env) => {

          if (env.turnId && env.turnId !== turnId) return;

          cleanup();

          activeTurnRef.current = null;

          callbacks.onError?.(String(env.message || 'Coach error'), env as Record<string, unknown>);

        }),

      );

      unsubscribers.push(

        subscribe('coach.cancelled', (env) => {

          if (!matchTurn(env)) return;

          cleanup();

          activeTurnRef.current = null;

          callbacks.onCancelled?.();

        }),

      );



      const ok = send({

        type: 'coach.send',

        text: payload.text,

        locale: payload.locale,

        conversationId: payload.conversationId,

        turnId,

      });



      if (!ok) {

        cleanup();

        return false;

      }

      return true;

    },

    [send, subscribe],

  );



  const sendCoachAction = useCallback(

    async (

      type: 'coach.confirm' | 'coach.cancelPending' | 'coach.disambiguate',

      payload: CoachActionPayload,

      callbacks: Pick<CoachStreamCallbacks, 'onDone' | 'onError' | 'onPhase' | 'onToken' | 'onStarted'>,

    ): Promise<boolean> => {

      const ready = await ensureRealtimeReady();

      if (!ready) return false;

      const unsubscribers: Array<() => void> = [];

      const cleanup = () => {

        for (const u of unsubscribers) u();

      };

      unsubscribers.push(

        subscribe('coach.started', (env) => {

          callbacks.onStarted?.(String(env.turnId || ''));

        }),

      );

      unsubscribers.push(

        subscribe('coach.phase', (env) => {

          callbacks.onPhase?.(String(env.phase || ''));

        }),

      );

      unsubscribers.push(

        subscribe('coach.token', (env) => {

          callbacks.onToken?.(String(env.delta || ''));

        }),

      );

      unsubscribers.push(

        subscribe('coach.done', (env) => {

          cleanup();

          callbacks.onDone?.(env as unknown as AiChatResponse & { turnId?: string; afterConfirm?: boolean });

        }),

      );

      unsubscribers.push(

        subscribe('coach.error', (env) => {

          cleanup();

          callbacks.onError?.(String(env.message || 'Coach error'), env as Record<string, unknown>);

        }),

      );

      const ok = send({ type, ...payload });

      if (!ok) {

        cleanup();

        return false;

      }

      return true;

    },

    [send, subscribe],

  );



  const sendCoachConfirm = useCallback(

    (

      payload: {
        actionId: string;
        locale?: 'en' | 'ar';
        conversationId?: string;
        confirmationPhrase?: string;
        password?: string;
      },

      callbacks: Pick<CoachStreamCallbacks, 'onDone' | 'onError' | 'onPhase'>,

    ) => sendCoachAction('coach.confirm', payload, callbacks),

    [sendCoachAction],

  );



  const sendCoachCancelPending = useCallback(

    (

      payload: { actionId: string; locale?: 'en' | 'ar'; conversationId?: string },

      callbacks: Pick<CoachStreamCallbacks, 'onDone' | 'onError' | 'onPhase'>,

    ) => sendCoachAction('coach.cancelPending', payload, callbacks),

    [sendCoachAction],

  );



  const sendCoachDisambiguate = useCallback(

    (

      payload: {

        actionId: string;

        foodItemId?: string;

        webtebId?: number;

        locale?: 'en' | 'ar';

        conversationId?: string;

      },

      callbacks: Pick<CoachStreamCallbacks, 'onDone' | 'onError' | 'onPhase'>,

    ) => sendCoachAction('coach.disambiguate', payload, callbacks),

    [sendCoachAction],

  );



  const cancelCoachMessage = useCallback(() => {

    const turnId = activeTurnRef.current;

    if (!turnId) return;

    send({ type: 'coach.cancel', turnId });

  }, [send]);



  return {

    sendCoachMessage,

    sendCoachConfirm,

    sendCoachCancelPending,

    sendCoachDisambiguate,

    cancelCoachMessage,

    isRealtimeOpen,

  };

}

