/**
 * Coach confirm / cancel / disambiguate — shared by REST and WebSocket.
 */
const { recordChatAdaptationAfterTools } = require('../lib/adaptation/chatSignals');
const { buildContextBundle } = require('../lib/contextBundle');
const { appendTurn } = require('../lib/chatMemory');
const {
  disambiguationReply,
  pendingForClient,
  serializeCandidates,
  resolveFoodPick,
  candidateDisplayName,
} = require('../lib/coach/foodDisambiguation');
const { notFoundReply } = require('../lib/coach/pendingActionReplies');
const { verifyStepUpAuth, stepUpClientFields, coachActionErrorBody, buildStepUpMeta } = require('../lib/coach/stepUpAuth');
const { buildTurnMeta } = require('./coachChatTurn');
const {
  updatePendingAction,
  getPendingByActionId,
  clearPendingAction,
} = require('./pendingActionService');
const { executePendingAction, buildExecuteReply, cancelReply } = require('./pendingActionExecute');

function clientPendingFields(pending) {
  const view = pendingForClient(pending);
  if (!view) return {};
  if (view.disambiguationRequired) {
    return {
      disambiguationRequired: true,
      disambiguationKind: view.disambiguationKind || 'food',
      candidates: view.candidates || [],
      disambiguationQuery: view.disambiguationQuery || '',
      confirmationRequired: false,
      confirmationPreview: null,
      actionId: view.actionId,
      expiresAt: view.expiresAt,
    };
  }
  return {
    confirmationRequired: true,
    confirmationPreview: view.confirmationPreview || view.preview || '',
    disambiguationRequired: false,
    actionId: view.actionId,
    expiresAt: view.expiresAt,
    ...stepUpClientFields(pending),
  };
}

async function persistDisambiguationCheckpoint(userId, pending, disambiguation) {
  return updatePendingAction(userId, pending.actionId, {
    phase: 'disambiguation',
    disambiguation: {
      kind: disambiguation.kind || 'food',
      candidates: serializeCandidates(disambiguation.candidates),
      grams: disambiguation.grams,
      query: pending.disambiguation?.query || '',
    },
    executionCheckpoint: {
      resumeFromIndex: disambiguation.resumeFromIndex ?? 0,
      completedResults: disambiguation.completedResults || [],
    },
  });
}

async function runPendingExecution({ userId, pending, threadId, contextBundle }) {
  const exec = await executePendingAction(pending, { threadId, contextBundle });

  if (exec.disambiguation) {
    const updated = await persistDisambiguationCheckpoint(userId, pending, exec.disambiguation);
    const locale = pending.locale === 'en' ? 'en' : 'ar';
    const query = updated?.disambiguation?.query || pending.disambiguation?.query || '';
    return {
      completed: false,
      disambiguation: true,
      pending: updated || pending,
      reply: disambiguationReply(locale, query),
      results: exec.results,
      intent: pending.intent,
      toolCalls: pending.tools.map((name) => ({ name, input: pending.inputsByTool?.[name] })),
    };
  }

  await clearPendingAction(userId, pending.actionId, pending.conversationId);
  const reply = buildExecuteReply(pending, exec.results, exec.reply);
  return {
    completed: true,
    disambiguation: false,
    reply,
    results: exec.results,
    intent: pending.intent,
    toolCalls: pending.tools.map((name) => ({ name, input: pending.inputsByTool?.[name] })),
  };
}

async function processCoachConfirm(
  userId,
  { actionId, conversationId, locale: bodyLocale, confirmationPhrase, password },
) {
  const locale = bodyLocale === 'en' ? 'en' : 'ar';
  const pending = await getPendingByActionId(userId, actionId);
  if (!pending) {
    return { ok: false, status: 404, error: notFoundReply(locale) };
  }

  const stepUpCheck = await verifyStepUpAuth({
    userId,
    pending,
    confirmationPhrase,
    password,
  });
  if (!stepUpCheck.ok) {
    return {
      ok: false,
      status: stepUpCheck.status || 403,
      ...coachActionErrorBody(stepUpCheck),
    };
  }

  if (pending.phase === 'disambiguation') {
    const view = pendingForClient(pending);
    return {
      ok: true,
      data: {
        reply: disambiguationReply(locale, view?.disambiguationQuery || ''),
        conversationId: conversationId || pending.conversationId,
        ...clientPendingFields(pending),
        intent: pending.intent,
      },
    };
  }

  const contextBundle = await buildContextBundle(userId);
  const outcome = await runPendingExecution({
    userId,
    pending,
    threadId: conversationId || pending.conversationId,
    contextBundle,
  });

  if (outcome.disambiguation) {
    const savedConversationId = await appendTurn({
      userId,
      conversationId: conversationId || pending.conversationId,
      locale,
      userMessage: locale === 'ar' ? '[تأكيد إجراء]' : '[Action confirmed]',
      assistantReply: outcome.reply,
      meta: buildTurnMeta({
        intent: outcome.intent,
        toolCalls: outcome.toolCalls,
        disambiguationRequired: true,
        actionId: outcome.pending?.actionId || pending.actionId,
        candidates: outcome.pending?.disambiguation?.candidates,
        disambiguationQuery: outcome.pending?.disambiguation?.query,
      }),
    }).catch(() => null);

    return {
      ok: true,
      data: {
        reply: outcome.reply,
        conversationId: savedConversationId,
        ...clientPendingFields(outcome.pending),
        toolCalls: outcome.toolCalls,
        intent: outcome.intent,
      },
    };
  }

  const successCount = (outcome.results || []).filter((r) => r.success).length;
  if (successCount > 0) {
    void recordChatAdaptationAfterTools(userId, pending.userMessage, pending.tools, {
      locale,
      success: true,
    }).catch(() => null);
  }

  const savedConversationId = await appendTurn({
    userId,
    conversationId: conversationId || pending.conversationId,
    locale,
    userMessage: locale === 'ar' ? '[تأكيد إجراء]' : '[Action confirmed]',
    assistantReply: outcome.reply,
    meta: { intent: outcome.intent, confirmedActionId: actionId, toolResults: outcome.results.length },
  }).catch(() => null);

  return {
    ok: true,
    data: {
      reply: outcome.reply,
      conversationId: savedConversationId,
      confirmationRequired: false,
      disambiguationRequired: false,
      toolCalls: outcome.toolCalls,
      intent: outcome.intent,
    },
  };
}

async function processCoachCancel(userId, { actionId, conversationId, locale: bodyLocale }) {
  const locale = bodyLocale === 'en' ? 'en' : 'ar';
  const pending = await getPendingByActionId(userId, actionId);
  if (!pending) {
    return { ok: false, status: 404, error: notFoundReply(locale) };
  }
  await clearPendingAction(userId, pending.actionId, pending.conversationId);
  const reply = cancelReply(locale);
  const savedConversationId = await appendTurn({
    userId,
    conversationId: conversationId || pending.conversationId,
    locale,
    userMessage: locale === 'ar' ? '[إلغاء إجراء]' : '[Action cancelled]',
    assistantReply: reply,
    meta: { cancelledActionId: actionId },
  }).catch(() => null);
  return {
    ok: true,
    data: {
      reply,
      conversationId: savedConversationId,
      confirmationRequired: false,
      intent: 'execute_action',
    },
  };
}

async function processCoachDisambiguate(
  userId,
  { actionId, conversationId, locale: bodyLocale, foodItemId, webtebId },
) {
  const locale = bodyLocale === 'en' ? 'en' : 'ar';
  const pending = await getPendingByActionId(userId, actionId);
  if (!pending || pending.phase !== 'disambiguation') {
    return { ok: false, status: 404, error: notFoundReply(locale) };
  }

  const candidates = serializeCandidates(pending.disambiguation?.candidates);
  const match = candidates.find(
    (c) =>
      (foodItemId && c.foodItemId === foodItemId) ||
      (webtebId != null && c.webtebId === Number(webtebId))
  );
  if (!match) {
    return {
      ok: false,
      status: 400,
      error: locale === 'ar' ? 'الاختيار غير صالح.' : 'Invalid food selection.',
    };
  }

  const resolved = await resolveFoodPick({
    foodItemId,
    webtebId,
    foodName: match.foodName,
  });
  if (!resolved?.foodItemId) {
    return {
      ok: false,
      status: 422,
      error: locale === 'ar' ? 'تعذّر استيراد هذا الأكل.' : 'Could not import that food.',
    };
  }

  const grams =
    match.grams ??
    pending.disambiguation?.grams ??
    pending.inputsByTool?.log_food?.grams ??
    150;
  const inputsByTool = {
    ...(pending.inputsByTool || {}),
    log_food: {
      ...(pending.inputsByTool?.log_food || {}),
      foodItemId: resolved.foodItemId,
      foodName: resolved.foodName || match.foodName || candidateDisplayName(match, locale),
      grams,
      rawText: pending.inputsByTool?.log_food?.rawText || pending.disambiguation?.query || '',
    },
  };

  const updated = await updatePendingAction(userId, actionId, {
    phase: 'confirm',
    inputsByTool,
    disambiguation: null,
  });

  const stepUpMeta = await buildStepUpMeta(
    userId,
    updated?.tools || pending.tools,
    locale,
    inputsByTool,
  );
  if (stepUpMeta.stepUpEligible) {
    await updatePendingAction(userId, actionId, {
      stepUpEligible: true,
      stepUpPhrase: stepUpMeta.stepUpPhrase,
      stepUpMethods: stepUpMeta.stepUpMethods,
    });
  }

  const pendingForStepUp = {
    ...(updated || pending),
    inputsByTool,
    stepUpEligible: stepUpMeta.stepUpEligible,
    stepUpPhrase: stepUpMeta.stepUpPhrase,
    stepUpMethods: stepUpMeta.stepUpMethods,
  };

  const pickLabel = candidateDisplayName(match, locale);
  const preview =
    pending.preview ||
    (locale === 'ar' ? `تسجيل وجبة: ${pickLabel}` : `Log food: ${pickLabel}`);

  const savedConversationId = await appendTurn({
    userId,
    conversationId: conversationId || pending.conversationId,
    locale,
    userMessage: locale === 'ar' ? `[اختيار: ${pickLabel}]` : `[Picked: ${pickLabel}]`,
    assistantReply:
      locale === 'ar'
        ? `تمام — سجّل **${pickLabel}** (${grams} جم). اضغط «تأكيد» لتنفيذ الإجراء.`
        : `Got it — logging **${pickLabel}** (${grams}g). Tap **Confirm** to run this action.`,
    meta: buildTurnMeta({
      intent: pending.intent,
      toolCalls: pending.tools.map((name) => ({ name })),
      confirmationRequired: true,
      actionId: pending.actionId,
      candidates: serializeCandidates(pending.disambiguation?.candidates),
      disambiguationQuery: pending.disambiguation?.query,
    }),
  }).catch(() => null);

  return {
    ok: true,
    data: {
      reply:
        locale === 'ar'
          ? `تمام — سجّل **${pickLabel}** (${grams} جم). اضغط «تأكيد» لتنفيذ الإجراء.`
          : `Got it — logging **${pickLabel}** (${grams}g). Tap **Confirm** to run this action.`,
      conversationId: savedConversationId,
      confirmationRequired: true,
      confirmationPreview: preview,
      disambiguationRequired: false,
      actionId: updated?.actionId || pending.actionId,
      expiresAt: updated?.expiresAt || pending.expiresAt,
      intent: pending.intent,
      ...stepUpClientFields(pendingForStepUp),
    },
  };
}

module.exports = {
  clientPendingFields,
  processCoachConfirm,
  processCoachCancel,
  processCoachDisambiguate,
  coachActionErrorBody,
};
