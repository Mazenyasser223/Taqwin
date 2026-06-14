/**
 * Shared coach chat turn processing (REST + WebSocket).
 */
const { logger } = require('../lib/logger');
const { isFastApiBridgeEnabled, chatViaFastApi } = require('./aiFastApiClient');
const { checkOffTopic } = require('../lib/coach/offTopicGuard');
const { buildContextBundle } = require('../lib/contextBundle');
const { resolveHistory, appendTurn } = require('../lib/chatMemory');
const { logAgentTrace } = require('./agentTraceService');
const { trackAnalyticsEvent } = require('./analyticsEventService');
const { captureException } = require('../lib/sentry');
const {
  savePendingAction,
  getActivePendingForConversation,
  clearPendingAction,
} = require('./pendingActionService');
const {
  preResolveLogFoodInput,
  disambiguationReply,
  serializeCandidates,
} = require('../lib/coach/foodDisambiguation');
const { buildStepUpMeta, resolveStepUpState } = require('../lib/coach/stepUpAuth');

function coachNotConfiguredError(locale) {
  return locale === 'ar'
    ? 'خدمة المدرب الذكي غير مُعدّة. فعّل FEATURE_AI_VIA_FASTAPI=true و AI_SERVICE_URL.'
    : 'AI coach service is not configured. Set FEATURE_AI_VIA_FASTAPI=true and AI_SERVICE_URL.';
}

function coachUnavailableError(locale) {
  return locale === 'ar'
    ? 'خدمة المدرب الذكي غير متاحة حالياً. حاول مرة أخرى بعد قليل.'
    : 'AI coach service is temporarily unavailable. Please try again shortly.';
}

function toolNamesFromCalls(toolCalls) {
  return (toolCalls || []).map((t) => t.name).filter(Boolean);
}

function inputsByToolFromCalls(toolCalls) {
  const out = {};
  for (const t of toolCalls || []) {
    if (t?.name) out[t.name] = t.input && typeof t.input === 'object' ? t.input : {};
  }
  return out;
}

function buildTurnMeta({
  intent,
  toolCalls,
  confirmationRequired,
  disambiguationRequired,
  actionId,
  turnId,
  candidates,
  disambiguationQuery,
  stepUpRequired,
  stepUpEligible,
  stepUpPhrase,
  stepUpMethods,
  stepUpIdleMs,
  pendingCreatedAt,
  stepUpStaleAt,
}) {
  return {
    intent,
    toolCalls: (toolCalls || []).length,
    confirmationRequired: Boolean(confirmationRequired),
    disambiguationRequired: Boolean(disambiguationRequired),
    disambiguationKind: disambiguationRequired ? 'food' : undefined,
    actionId: actionId || null,
    turnId: turnId || null,
    candidates: disambiguationRequired ? serializeCandidates(candidates) : undefined,
    disambiguationQuery: disambiguationQuery || undefined,
    stepUpRequired: Boolean(stepUpRequired),
    stepUpEligible: Boolean(stepUpEligible),
    stepUpPhrase: stepUpPhrase || null,
    stepUpMethods: Array.isArray(stepUpMethods) ? stepUpMethods : undefined,
    stepUpIdleMs: stepUpIdleMs || undefined,
    pendingCreatedAt: pendingCreatedAt || undefined,
    stepUpStaleAt: stepUpStaleAt || undefined,
  };
}

async function applyPreConfirmFoodResolve(inputsByTool, locale) {
  if (!inputsByTool?.log_food || inputsByTool.log_food.foodItemId) {
    return { inputsByTool, phase: 'confirm' };
  }

  const pre = await preResolveLogFoodInput(inputsByTool.log_food);
  if (pre.status === 'resolved') {
    return {
      inputsByTool: { ...inputsByTool, log_food: pre.input },
      phase: 'confirm',
    };
  }
  if (pre.status === 'disambiguation') {
    return {
      inputsByTool,
      phase: 'disambiguation',
      disambiguation: {
        kind: 'food',
        candidates: pre.candidates,
        grams: pre.grams,
        query: pre.query,
      },
      replyOverride: disambiguationReply(locale, pre.query),
    };
  }
  return { inputsByTool, phase: 'confirm' };
}

/**
 * @param {string} userId
 * @param {{
 *   messages: Array<{ role: string, content: string }>,
 *   locale?: 'en'|'ar',
 *   conversationId?: string,
 *   threadId?: string,
 *   fastApiResult?: Awaited<ReturnType<typeof chatViaFastApi>>,
 * }} opts
 */
async function processCoachChatTurn(userId, opts) {
  const chatStarted = Date.now();
  const { messages, conversationId, threadId: bodyThreadId } = opts;
  const threadId = bodyThreadId || conversationId || undefined;

  const contextBundle = await buildContextBundle(userId);
  const locale =
    opts.locale === 'en' || opts.locale === 'ar' ? opts.locale : contextBundle.locale || 'ar';

  const lastUserTurn = [...messages].reverse().find((m) => m.role === 'user');
  const lastUserMsg = lastUserTurn?.content || '';

  if (!isFastApiBridgeEnabled()) {
    return { ok: false, status: 503, error: coachNotConfiguredError(locale) };
  }

  const { historyMessages, conversation } = await resolveHistory({
    userId,
    conversationId,
    locale,
  });
  const resolvedConversationId = conversation?._id?.toString() || conversationId;

  const activePending = await getActivePendingForConversation(userId, resolvedConversationId);

  const guardResult = await checkOffTopic(lastUserMsg, { locale }).catch(() => ({
    inDomain: true,
    reason: 'guard-error',
  }));
  if (!guardResult.inDomain && guardResult.offTopicReply) {
    const reply = guardResult.offTopicReply;
    await appendTurn({
      userId,
      conversationId: resolvedConversationId,
      locale,
      userMessage: lastUserMsg,
      assistantReply: reply,
      meta: { offTopic: true, reason: guardResult.reason },
    }).catch(() => null);
    return {
      ok: true,
      data: { reply, offTopic: true, conversationId: resolvedConversationId },
    };
  }

  const llmMessages = [...historyMessages, ...(lastUserTurn ? [lastUserTurn] : [])].slice(-30);

  let fastApi = opts.fastApiResult;
  if (!fastApi) {
    try {
      fastApi = await chatViaFastApi({
        userId,
        threadId,
        messages: llmMessages,
        locale,
        contextBundle,
        pendingAction: activePending
          ? {
              actionId: activePending.actionId,
              preview: activePending.preview,
              tools: activePending.tools,
            }
          : null,
      });
    } catch (err) {
      logger.warn({ err }, 'FastAPI chat failed');
      captureException(err, { route: 'coachChatTurn', userId });
      void logAgentTrace({
        userId,
        threadId,
        intent: 'unknown',
        locale,
        success: false,
        error: err.message || 'fastapi_chat_failed',
        latencyMs: Date.now() - chatStarted,
        nodes: [{ step: 'fastapi_error' }],
      }).catch(() => null);
      return { ok: false, status: 502, error: coachUnavailableError(locale) };
    }
  }

  const reply = fastApi.reply || '';
  let confirmationRequired = Boolean(fastApi.confirmationRequired);
  let confirmationPreview = fastApi.confirmationPreview ?? null;
  const toolCalls = fastApi.toolCalls ?? [];
  const chatIntent = fastApi.intent ?? 'general';
  let actionId = null;
  let expiresAt = null;
  let stepUpRequired = false;
  let stepUpEligible = false;
  let stepUpPhrase = null;
  let stepUpMethods = [];
  let stepUpIdleMs = null;
  let pendingCreatedAt = null;
  let stepUpStaleAt = null;
  let disambiguationRequired = false;
  let disambiguationKind = null;
  let candidates = [];
  let disambiguationQuery = '';
  let responseReply = reply;

  if (fastApi.pendingCancelled && activePending) {
    await clearPendingAction(userId, activePending.actionId, resolvedConversationId);
  }

  if (confirmationRequired) {
    if (activePending) {
      await clearPendingAction(userId, activePending.actionId, resolvedConversationId);
    }

    let inputsByTool = inputsByToolFromCalls(toolCalls);
    const tools = toolNamesFromCalls(toolCalls);
    let phase = 'confirm';
    let disambiguation = null;

    if (tools.includes('log_food')) {
      const pre = await applyPreConfirmFoodResolve(inputsByTool, locale);
      inputsByTool = pre.inputsByTool;
      phase = pre.phase;
      if (pre.disambiguation) {
        disambiguation = pre.disambiguation;
        disambiguationRequired = true;
        disambiguationKind = 'food';
        candidates = pre.disambiguation.candidates || [];
        disambiguationQuery = pre.disambiguation.query || '';
        responseReply = pre.replyOverride || responseReply;
        confirmationRequired = false;
        confirmationPreview = null;
      }
    }

    const stepUpMeta = await buildStepUpMeta(userId, tools, locale, inputsByTool);
    stepUpEligible = stepUpMeta.stepUpEligible;
    stepUpPhrase = stepUpMeta.stepUpPhrase;
    stepUpMethods = stepUpMeta.stepUpMethods;
    stepUpIdleMs = stepUpMeta.stepUpIdleMs;

    const stored = await savePendingAction({
      userId,
      conversationId: resolvedConversationId,
      tools,
      inputsByTool,
      planSteps: Array.isArray(fastApi.planSteps) ? fastApi.planSteps : [],
      preview: confirmationPreview || '',
      intent: chatIntent,
      userMessage: fastApi.sourceUserMessage || lastUserMsg,
      locale,
      phase,
      disambiguation,
      stepUpEligible: stepUpMeta.stepUpEligible,
      stepUpPhrase: stepUpMeta.stepUpPhrase,
      stepUpMethods: stepUpMeta.stepUpMethods,
    });
    actionId = stored.actionId;
    expiresAt = stored.expiresAt;
    pendingCreatedAt = stored.createdAt || new Date().toISOString();

    const stepUpState = resolveStepUpState({
      tools,
      inputsByTool,
      locale,
      stepUpEligible: stepUpMeta.stepUpEligible,
      stepUpPhrase: stepUpMeta.stepUpPhrase,
      stepUpMethods: stepUpMeta.stepUpMethods,
      createdAt: pendingCreatedAt,
      expiresAt,
    });
    stepUpRequired = stepUpState.stepUpRequired;
    stepUpStaleAt = stepUpState.stepUpStaleAt;
  }

  const savedConversationId = await appendTurn({
    userId,
    conversationId: resolvedConversationId,
    locale,
    userMessage: lastUserMsg,
    assistantReply: responseReply,
    meta: buildTurnMeta({
      intent: chatIntent,
      toolCalls,
      confirmationRequired,
      disambiguationRequired,
      actionId,
      turnId: fastApi.turnId || null,
      candidates,
      disambiguationQuery,
      stepUpRequired,
      stepUpEligible,
      stepUpPhrase,
      stepUpMethods,
      stepUpIdleMs,
      pendingCreatedAt,
      stepUpStaleAt,
    }),
  });

  void trackAnalyticsEvent({
    event: 'ai.chat.completed',
    userId,
    properties: {
      locale,
      intent: chatIntent,
      toolCalls: toolCalls.length,
      latencyMs: Date.now() - chatStarted,
      hadPendingAction: Boolean(actionId),
    },
  }).catch(() => null);

  return {
    ok: true,
    data: {
      reply: responseReply,
      conversationId: savedConversationId,
      confirmationRequired,
      confirmationPreview,
      disambiguationRequired,
      disambiguationKind,
      candidates: disambiguationRequired ? candidates : undefined,
      disambiguationQuery: disambiguationRequired ? disambiguationQuery : undefined,
      actionId,
      expiresAt,
      stepUpRequired,
      stepUpEligible,
      stepUpPhrase,
      stepUpMethods,
      stepUpIdleMs,
      pendingCreatedAt,
      stepUpStaleAt,
      toolCalls,
      planSteps: Array.isArray(fastApi.planSteps) ? fastApi.planSteps : [],
      intent: chatIntent,
      turnId: fastApi.turnId || null,
    },
  };
}

module.exports = {
  coachNotConfiguredError,
  coachUnavailableError,
  buildTurnMeta,
  toolNamesFromCalls,
  inputsByToolFromCalls,
  applyPreConfirmFoodResolve,
  processCoachChatTurn,
};
