/**
 * WebSocket coach.send handler — streams tokens then persists turn.
 */
const { logger } = require('../../lib/logger');
const { isFastApiBridgeEnabled } = require('../../services/aiFastApiClient');
const { buildContextBundle } = require('../../lib/contextBundle');
const { resolveHistory } = require('../../lib/chatMemory');
const { getActivePendingForConversation } = require('../../services/pendingActionService');
const { checkOffTopic } = require('../../lib/coach/offTopicGuard');
const { isGreetingMessage, buildGreetingReply } = require('../../lib/coach/coachGreeting');
const { chatStreamViaFastApi } = require('../../services/coachChatStream');
const { processCoachChatTurn, coachNotConfiguredError, coachUnavailableError } = require('../../services/coachChatTurn');
const { serverEnvelope } = require('../envelope');
const { streamTextAsCoachTokens, createCoachTokenCoalescer } = require('../streamCoachTokens');

/** @type {Map<string, AbortController>} */
const activeTurns = new Map();

function cancelCoachTurn(userId, turnId) {
  const key = turnId ? `${userId}:${turnId}` : null;
  if (!key) return false;
  const ctrl = activeTurns.get(key);
  if (!ctrl) return false;
  ctrl.abort();
  activeTurns.delete(key);
  return true;
}

function send(ws, envelope) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(envelope));
}

/**
 * @param {import('ws').WebSocket} ws
 * @param {string} userId
 * @param {{ text: string, conversationId?: string, threadId?: string, locale?: 'en'|'ar', turnId?: string }} payload
 */
async function handleCoachSend(ws, userId, payload) {
  const turnId = payload.turnId || `turn-${Date.now()}`;
  const locale = payload.locale === 'en' ? 'en' : payload.locale === 'ar' ? 'ar' : undefined;
  const conversationId = payload.conversationId;
  const threadId = payload.threadId || conversationId;
  const text = String(payload.text || '').trim();
  if (!text) {
    send(ws, serverEnvelope('coach.error', { message: 'Empty message', turnId }));
    return;
  }

  if (!isFastApiBridgeEnabled()) {
    send(ws, serverEnvelope('coach.error', { message: coachNotConfiguredError(locale || 'en'), turnId }));
    return;
  }

  const abortKey = `${userId}:${turnId}`;
  const controller = new AbortController();
  activeTurns.set(abortKey, controller);

  send(ws, serverEnvelope('coach.started', { turnId, conversationId: conversationId || null }));

  try {
    const contextBundle = await buildContextBundle(userId);
    const resolvedLocale =
      locale || (contextBundle.locale === 'en' ? 'en' : contextBundle.locale === 'ar' ? 'ar' : 'ar');

    const guardResult = await checkOffTopic(text, { locale: resolvedLocale }).catch(() => ({
      inDomain: true,
    }));
    if (!guardResult.inDomain && guardResult.offTopicReply) {
      const result = await processCoachChatTurn(userId, {
        messages: [{ role: 'user', content: text }],
        locale: resolvedLocale,
        conversationId,
        threadId,
      });
      if (result.ok) {
        const reply = result.data?.reply || guardResult.offTopicReply;
        await streamTextAsCoachTokens(send, ws, turnId, reply, { signal: controller.signal });
        if (!controller.signal.aborted) {
          send(ws, serverEnvelope('coach.done', { turnId, ...result.data }));
        }
      } else {
        send(ws, serverEnvelope('coach.error', { turnId, message: result.error || 'Chat failed' }));
      }
      return;
    }

    const { historyMessages, conversation } = await resolveHistory({
      userId,
      conversationId,
      locale: resolvedLocale,
    });
    const resolvedConversationId = conversation?._id?.toString() || conversationId;
    const activePending = await getActivePendingForConversation(userId, resolvedConversationId);

    if (!activePending && isGreetingMessage(text)) {
      const reply = buildGreetingReply({
        locale: resolvedLocale,
        displayName: contextBundle?.profile?.displayName,
      });
      await streamTextAsCoachTokens(send, ws, turnId, reply, { signal: controller.signal });
      if (controller.signal.aborted) {
        send(ws, serverEnvelope('coach.cancelled', { turnId }));
        return;
      }
      send(ws, serverEnvelope('coach.phase', { turnId, phase: 'saving' }));
      const result = await processCoachChatTurn(userId, {
        messages: [{ role: 'user', content: text }],
        locale: resolvedLocale,
        conversationId: resolvedConversationId,
        threadId,
        fastApiResult: {
          reply,
          intent: 'greeting',
          toolCalls: [],
          confirmationRequired: false,
          confirmationPreview: null,
          pendingCancelled: false,
          planSteps: [],
          turnId,
        },
      });
      if (!result.ok) {
        send(ws, serverEnvelope('coach.error', { turnId, message: result.error || 'Chat failed' }));
        return;
      }
      send(ws, serverEnvelope('coach.done', { turnId, ...result.data }));
      return;
    }

    const llmMessages = [...historyMessages, { role: 'user', content: text }].slice(-30);

    let streamDone = null;
    const tokenCoalescer = createCoachTokenCoalescer(send, ws, turnId);

    await chatStreamViaFastApi(
      {
        userId,
        threadId,
        messages: llmMessages,
        locale: resolvedLocale,
        contextBundle,
        pendingAction: activePending
          ? {
              actionId: activePending.actionId,
              preview: activePending.preview,
              tools: activePending.tools,
            }
          : null,
      },
      ({ event, data }) => {
        if (controller.signal.aborted) return;
        if (event === 'phase') {
          send(ws, serverEnvelope('coach.phase', { turnId, phase: data.phase || 'unknown' }));
        } else if (event === 'token') {
          tokenCoalescer.push(data.delta || '');
        } else if (event === 'done') {
          streamDone = data;
        } else if (event === 'error') {
          send(ws, serverEnvelope('coach.error', { turnId, message: data.message || 'Stream failed' }));
        }
      },
      controller.signal
    );

    tokenCoalescer.flush();

    if (controller.signal.aborted) {
      send(ws, serverEnvelope('coach.cancelled', { turnId }));
      return;
    }

    if (!streamDone) {
      send(ws, serverEnvelope('coach.error', { turnId, message: coachUnavailableError(resolvedLocale) }));
      return;
    }

    send(ws, serverEnvelope('coach.phase', { turnId, phase: 'saving' }));

    const fastApiResult = {
      reply: streamDone.reply || '',
      toolCalls: Array.isArray(streamDone.toolCalls) ? streamDone.toolCalls : [],
      confirmationRequired: Boolean(streamDone.confirmationRequired),
      confirmationPreview:
        typeof streamDone.confirmationPreview === 'string' ? streamDone.confirmationPreview : null,
      intent: typeof streamDone.intent === 'string' ? streamDone.intent : 'general',
      pendingCancelled: Boolean(streamDone.pendingCancelled),
      sourceUserMessage:
        typeof streamDone.sourceUserMessage === 'string' ? streamDone.sourceUserMessage : undefined,
      planSteps: Array.isArray(streamDone.planSteps) ? streamDone.planSteps : [],
      turnId: typeof streamDone.turnId === 'string' ? streamDone.turnId : turnId,
    };

    const result = await processCoachChatTurn(userId, {
      messages: [{ role: 'user', content: text }],
      locale: resolvedLocale,
      conversationId: resolvedConversationId,
      threadId,
      fastApiResult,
    });

    if (!result.ok) {
      send(ws, serverEnvelope('coach.error', { turnId, message: result.error || 'Chat failed' }));
      return;
    }

    send(ws, serverEnvelope('coach.done', { turnId, ...result.data }));
  } catch (err) {
    if (controller.signal.aborted) {
      send(ws, serverEnvelope('coach.cancelled', { turnId }));
    } else {
      logger.warn({ err, userId }, 'WS coach.send failed');
      send(ws, serverEnvelope('coach.error', { turnId, message: coachUnavailableError(locale || 'en') }));
    }
  } finally {
    activeTurns.delete(abortKey);
  }
}

function handleCoachCancel(ws, userId, payload) {
  const turnId = payload.turnId;
  if (!turnId) {
    send(ws, serverEnvelope('coach.error', { message: 'turnId required' }));
    return;
  }
  const cancelled = cancelCoachTurn(userId, turnId);
  send(ws, serverEnvelope(cancelled ? 'coach.cancelled' : 'coach.error', { turnId, message: cancelled ? undefined : 'No active turn' }));
}

module.exports = {
  handleCoachSend,
  handleCoachCancel,
  cancelCoachTurn,
};
