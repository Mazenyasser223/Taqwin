/**
 * Server-stored pending chat actions (confirm by actionId, not message history).
 * Redis when available; in-memory fallback for dev/tests.
 */
const crypto = require('crypto');
const { redisGetJson, redisSetJson, redisDel, isRedisEnabled } = require('../lib/redis');
const { logger } = require('../lib/logger');

const DEFAULT_TTL_MS = Number(process.env.PENDING_ACTION_TTL_MS) || 15 * 60 * 1000;
const memoryStore = new Map();

function pendingKey(actionId) {
  return `pending:action:${actionId}`;
}

function conversationIndexKey(userId, conversationId) {
  return `pending:conv:${userId}:${conversationId}`;
}

function purgeExpiredMemory() {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}

async function setJson(key, value, ttlMs) {
  if (isRedisEnabled()) {
    await redisSetJson(key, value, ttlMs);
    return;
  }
  purgeExpiredMemory();
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function getJson(key) {
  if (isRedisEnabled()) {
    return redisGetJson(key);
  }
  purgeExpiredMemory();
  const entry = memoryStore.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

async function delKey(key) {
  if (isRedisEnabled()) {
    await redisDel(key);
    return;
  }
  memoryStore.delete(key);
}

function isExpired(payload) {
  if (!payload?.expiresAt) return true;
  return new Date(payload.expiresAt).getTime() <= Date.now();
}

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.conversationId
 * @param {string[]} opts.tools
 * @param {Record<string, object>} opts.inputsByTool
 * @param {string} opts.preview
 * @param {string} opts.intent
 * @param {string} opts.userMessage
 * @param {'en'|'ar'} opts.locale
 * @param {boolean} [opts.stepUpEligible]
 * @param {string|null} [opts.stepUpPhrase]
 * @param {string[]} [opts.stepUpMethods]
 */
async function savePendingAction({
  userId,
  conversationId,
  tools,
  inputsByTool,
  planSteps,
  preview,
  intent,
  userMessage,
  locale,
  phase,
  disambiguation,
  executionCheckpoint,
  stepUpEligible,
  stepUpPhrase,
  stepUpMethods,
}) {
  const actionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS).toISOString();
  const payload = {
    actionId,
    userId,
    conversationId,
    tools: tools || [],
    inputsByTool: inputsByTool || {},
    planSteps: Array.isArray(planSteps) ? planSteps : [],
    preview: preview || '',
    intent: intent || 'execute_action',
    userMessage: userMessage || '',
    locale: locale === 'en' ? 'en' : 'ar',
    phase: phase === 'disambiguation' ? 'disambiguation' : 'confirm',
    disambiguation: disambiguation || null,
    executionCheckpoint: executionCheckpoint || null,
    stepUpEligible: Boolean(stepUpEligible),
    stepUpPhrase: stepUpPhrase || null,
    stepUpMethods: Array.isArray(stepUpMethods) ? stepUpMethods : [],
    expiresAt,
    createdAt: new Date().toISOString(),
  };

  await setJson(pendingKey(actionId), payload, DEFAULT_TTL_MS);
  if (conversationId) {
    await setJson(conversationIndexKey(userId, conversationId), { actionId }, DEFAULT_TTL_MS);
  }
  return { actionId, expiresAt, createdAt: payload.createdAt };
}

async function updatePendingAction(userId, actionId, patch) {
  const payload = await getPendingByActionId(userId, actionId);
  if (!payload) return null;
  const updated = {
    ...payload,
    ...patch,
    actionId: payload.actionId,
    userId: payload.userId,
  };
  const ttlRemaining = Math.max(
    60_000,
    new Date(payload.expiresAt).getTime() - Date.now()
  );
  await setJson(pendingKey(actionId), updated, ttlRemaining);
  if (payload.conversationId) {
    await setJson(
      conversationIndexKey(userId, payload.conversationId),
      { actionId },
      ttlRemaining
    );
  }
  return updated;
}

async function getPendingByActionId(userId, actionId) {
  if (!actionId) return null;
  const payload = await getJson(pendingKey(actionId));
  if (!payload || payload.userId !== userId) return null;
  if (isExpired(payload)) {
    await clearPendingAction(userId, actionId, payload.conversationId);
    return null;
  }
  return payload;
}

async function getActivePendingForConversation(userId, conversationId) {
  if (!conversationId) return null;
  const index = await getJson(conversationIndexKey(userId, conversationId));
  if (!index?.actionId) return null;
  return getPendingByActionId(userId, index.actionId);
}

async function clearPendingAction(userId, actionId, conversationId) {
  if (actionId) await delKey(pendingKey(actionId));
  if (conversationId) await delKey(conversationIndexKey(userId, conversationId));
}

module.exports = {
  savePendingAction,
  updatePendingAction,
  getPendingByActionId,
  getActivePendingForConversation,
  clearPendingAction,
  DEFAULT_TTL_MS,
};
