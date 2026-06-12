/**
 * Second gate for high-impact coach tools — phrase or password after stale pending.
 * Config: shared/coach-step-up.json (STEP_UP_* env overrides).
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { prisma } = require('../../db');
const { redisGetJson, redisSetJson, redisDel, isRedisEnabled } = require('../redis');
const { trackAnalyticsEvent } = require('../../services/analyticsEventService');

const CONFIG_PATH = path.resolve(__dirname, '../../../../shared/coach-step-up.json');

function loadSharedConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      stepUpTools: ['adapt_plan', 'set_life_mode'],
      idleMs: 300_000,
      maxFailedAttempts: 5,
      lockoutMs: 900_000,
    };
  }
}

const SHARED = loadSharedConfig();
const STEP_UP_TOOLS = new Set(SHARED.stepUpTools || []);
const STEP_UP_IDLE_MS = Number(process.env.STEP_UP_IDLE_MS) || Number(SHARED.idleMs) || 300_000;
const STEP_UP_MAX_FAILS = Number(process.env.STEP_UP_MAX_FAILS) || Number(SHARED.maxFailedAttempts) || 5;
const STEP_UP_LOCKOUT_MS =
  Number(process.env.STEP_UP_LOCKOUT_MS) || Number(SHARED.lockoutMs) || 900_000;

const STEP_UP_TOOL_PRIORITY = [
  'set_life_mode',
  'adapt_plan',
  'update_fitness_goal',
  'generate_weekly_workout',
  'generate_weekly_diet',
  'replace_exercise_today',
];

const failMemory = new Map();

function failKey(userId, actionId) {
  return `stepup:fail:${userId}:${actionId}`;
}

function purgeFailMemory() {
  const now = Date.now();
  for (const [key, entry] of failMemory.entries()) {
    if (entry.expiresAt <= now) failMemory.delete(key);
  }
}

async function getFailRecord(userId, actionId) {
  const key = failKey(userId, actionId);
  if (isRedisEnabled()) {
    return redisGetJson(key);
  }
  purgeFailMemory();
  const entry = failMemory.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    failMemory.delete(key);
    return null;
  }
  return entry.value;
}

async function setFailRecord(userId, actionId, value, ttlMs) {
  const key = failKey(userId, actionId);
  if (isRedisEnabled()) {
    await redisSetJson(key, value, ttlMs);
    return;
  }
  purgeFailMemory();
  failMemory.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function clearFailRecord(userId, actionId) {
  const key = failKey(userId, actionId);
  if (isRedisEnabled()) {
    await redisDel(key);
    return;
  }
  failMemory.delete(key);
}

function getDefaultStepUpPhrase(locale) {
  return locale === 'ar' ? 'تعديل' : 'ADAPT';
}

function resolveStepUpPhrase(tools, inputsByTool, locale) {
  const list = tools || [];
  for (const tool of STEP_UP_TOOL_PRIORITY) {
    if (!list.includes(tool)) continue;
    const input = inputsByTool?.[tool] || {};
    if (tool === 'set_life_mode') {
      const mode = String(input.lifeMode || '').trim();
      if (mode) return mode.toUpperCase().replace(/_/g, '');
      return locale === 'ar' ? 'وضع' : 'MODE';
    }
    if (tool === 'adapt_plan') return getDefaultStepUpPhrase(locale);
    if (tool === 'update_fitness_goal') return locale === 'ar' ? 'هدف' : 'GOAL';
    if (tool === 'generate_weekly_workout' || tool === 'generate_weekly_diet') {
      return locale === 'ar' ? 'أسبوع' : 'WEEKLY';
    }
    if (tool === 'replace_exercise_today') return locale === 'ar' ? 'استبدال' : 'REPLACE';
  }
  return getDefaultStepUpPhrase(locale);
}

function pendingRequiresStepUp(tools) {
  return (tools || []).some((name) => STEP_UP_TOOLS.has(name));
}

function pendingStepUpEligible(pending) {
  if (pending?.stepUpEligible) return true;
  return pendingRequiresStepUp(pending?.tools);
}

const PENDING_TTL_MS = Number(process.env.PENDING_ACTION_TTL_MS) || 15 * 60 * 1000;

function getPendingCreatedMs(pending) {
  if (pending?.createdAt) return new Date(pending.createdAt).getTime();
  if (pending?.expiresAt) {
    return new Date(pending.expiresAt).getTime() - PENDING_TTL_MS;
  }
  return Date.now();
}

function isPendingStale(pending) {
  if (!pendingStepUpEligible(pending)) return false;
  return Date.now() - getPendingCreatedMs(pending) >= STEP_UP_IDLE_MS;
}

function getStepUpIdleMs() {
  return STEP_UP_IDLE_MS;
}

function phrasesMatch(got, expected) {
  const a = String(got || '').trim();
  const b = String(expected || '').trim();
  if (!a || !b) return false;
  if (/^[A-Za-z]+$/.test(b)) {
    return a.toUpperCase() === b.toUpperCase();
  }
  return a === b;
}

function stepUpRequiredError(locale, phrase) {
  const p = phrase || getDefaultStepUpPhrase(locale);
  if (locale === 'ar') {
    return `مطلوب تأكيد إضافي — اكتب ${p} أو أدخل كلمة المرور.`;
  }
  return `Extra confirmation required — type ${p} or enter your password.`;
}

function stepUpInvalidPasswordError(locale) {
  return locale === 'ar' ? 'كلمة المرور غير صحيحة.' : 'Incorrect password.';
}

function stepUpNoPasswordError(locale, phrase) {
  const p = phrase || getDefaultStepUpPhrase(locale);
  return locale === 'ar'
    ? `لا توجد كلمة مرور على الحساب — اكتب ${p} للتأكيد.`
    : `No password on this account — type ${p} to confirm.`;
}

function stepUpLockoutError(locale) {
  const mins = Math.ceil(STEP_UP_LOCKOUT_MS / 60_000);
  return locale === 'ar'
    ? `محاولات كثيرة — انتظر ${mins} دقيقة ثم أعد المحاولة أو ألغِ الإجراء.`
    : `Too many attempts — wait ${mins} minutes, then try again or cancel.`;
}

async function getStepUpMethods(userId) {
  const methods = ['phrase'];
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (user?.passwordHash) {
    methods.push('password');
  }
  return methods;
}

/**
 * Resolve client-facing step-up state from a pending action (staleness-aware).
 */
function resolveStepUpState(pending) {
  const eligible = pendingStepUpEligible(pending);
  const idleMs = getStepUpIdleMs();
  const createdMs = getPendingCreatedMs(pending);
  const staleAtMs = createdMs + idleMs;
  const stale = eligible && Date.now() >= staleAtMs;
  const locale = pending?.locale === 'en' ? 'en' : 'ar';
  const phrase =
    pending?.stepUpPhrase ||
    resolveStepUpPhrase(pending?.tools, pending?.inputsByTool, locale);

  if (!eligible) {
    return {
      stepUpEligible: false,
      stepUpRequired: false,
      stepUpPhrase: null,
      stepUpMethods: [],
      stepUpIdleMs: idleMs,
      pendingCreatedAt: new Date(createdMs).toISOString(),
      stepUpStaleAt: null,
    };
  }

  const methods =
    Array.isArray(pending?.stepUpMethods) && pending.stepUpMethods.length
      ? pending.stepUpMethods
      : ['phrase'];

  return {
    stepUpEligible: true,
    stepUpRequired: stale,
    stepUpPhrase: phrase,
    stepUpMethods: methods,
    stepUpIdleMs: idleMs,
    pendingCreatedAt: new Date(createdMs).toISOString(),
    stepUpStaleAt: new Date(staleAtMs).toISOString(),
  };
}

/**
 * @param {string} userId
 * @param {string[]} tools
 * @param {'en'|'ar'} locale
 * @param {Record<string, object>} [inputsByTool]
 */
async function buildStepUpMeta(userId, tools, locale, inputsByTool = {}) {
  if (!pendingRequiresStepUp(tools)) {
    return {
      stepUpEligible: false,
      requiresStepUp: false,
      stepUpPhrase: null,
      stepUpMethods: [],
      stepUpIdleMs: getStepUpIdleMs(),
    };
  }

  const methods = await getStepUpMethods(userId);
  const phrase = resolveStepUpPhrase(tools, inputsByTool, locale);

  return {
    stepUpEligible: true,
    requiresStepUp: false,
    stepUpPhrase: phrase,
    stepUpMethods: methods,
    stepUpIdleMs: getStepUpIdleMs(),
  };
}

async function checkStepUpLockout(userId, actionId, locale) {
  const record = await getFailRecord(userId, actionId);
  if (!record?.lockedUntil) return null;
  if (Date.now() < record.lockedUntil) {
    return { ok: false, status: 429, error: stepUpLockoutError(locale), code: 'STEP_UP_LOCKOUT' };
  }
  await clearFailRecord(userId, actionId);
  return null;
}

async function recordStepUpFailure(userId, actionId, pending, reason) {
  const record = (await getFailRecord(userId, actionId)) || { count: 0 };
  const count = (record.count || 0) + 1;
  const next = { count, lastAt: Date.now() };
  if (count >= STEP_UP_MAX_FAILS) {
    next.lockedUntil = Date.now() + STEP_UP_LOCKOUT_MS;
  }
  await setFailRecord(userId, actionId, next, STEP_UP_LOCKOUT_MS);

  void trackAnalyticsEvent({
    event: 'coach.step_up_failed',
    userId,
    properties: {
      actionId,
      tools: pending?.tools || [],
      reason,
      attempt: count,
      locked: Boolean(next.lockedUntil),
    },
  }).catch(() => null);
}

function trackStepUpSuccess(userId, pending, method) {
  void trackAnalyticsEvent({
    event: 'coach.step_up_succeeded',
    userId,
    properties: {
      actionId: pending?.actionId,
      tools: pending?.tools || [],
      method,
    },
  }).catch(() => null);
}

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {object} opts.pending
 * @param {string} [opts.confirmationPhrase]
 * @param {string} [opts.password]
 */
async function verifyStepUpAuth({ userId, pending, confirmationPhrase, password }) {
  const state = resolveStepUpState(pending);
  const locale = pending?.locale === 'en' ? 'en' : 'ar';
  const clientFields = stepUpClientFields(pending);

  if (!state.stepUpRequired) {
    return { ok: true, method: null, ...clientFields };
  }

  const lockout = await checkStepUpLockout(userId, pending.actionId, locale);
  if (lockout) {
    return { ...lockout, ...clientFields };
  }

  const expected = state.stepUpPhrase || getDefaultStepUpPhrase(locale);

  if (confirmationPhrase && phrasesMatch(confirmationPhrase, expected)) {
    await clearFailRecord(userId, pending.actionId);
    trackStepUpSuccess(userId, pending, 'phrase');
    return { ok: true, method: 'phrase', ...clientFields };
  }

  if (password) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) {
      await recordStepUpFailure(userId, pending.actionId, pending, 'no_password');
      return {
        ok: false,
        status: 403,
        error: stepUpNoPasswordError(locale, expected),
        code: 'STEP_UP_NO_PASSWORD',
        ...clientFields,
      };
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (valid) {
      await clearFailRecord(userId, pending.actionId);
      trackStepUpSuccess(userId, pending, 'password');
      return { ok: true, method: 'password', ...clientFields };
    }
    await recordStepUpFailure(userId, pending.actionId, pending, 'invalid_password');
    return {
      ok: false,
      status: 401,
      error: stepUpInvalidPasswordError(locale),
      code: 'STEP_UP_INVALID_PASSWORD',
      ...clientFields,
    };
  }

  await recordStepUpFailure(userId, pending.actionId, pending, 'missing_proof');
  return {
    ok: false,
    status: 403,
    error: stepUpRequiredError(locale, expected),
    code: 'STEP_UP_REQUIRED',
    ...clientFields,
  };
}

function stepUpClientFields(pending) {
  return resolveStepUpState(pending || {});
}

function coachActionErrorBody(result) {
  return {
    error: result.error,
    code: result.code || null,
    stepUpEligible: result.stepUpEligible,
    stepUpRequired: result.stepUpRequired,
    stepUpPhrase: result.stepUpPhrase,
    stepUpMethods: result.stepUpMethods,
    stepUpIdleMs: result.stepUpIdleMs,
    pendingCreatedAt: result.pendingCreatedAt,
    stepUpStaleAt: result.stepUpStaleAt,
  };
}

module.exports = {
  STEP_UP_TOOLS,
  STEP_UP_IDLE_MS,
  STEP_UP_MAX_FAILS,
  STEP_UP_LOCKOUT_MS,
  getStepUpIdleMs,
  getDefaultStepUpPhrase,
  getStepUpPhrase: getDefaultStepUpPhrase,
  resolveStepUpPhrase,
  pendingRequiresStepUp,
  pendingStepUpEligible,
  isPendingStale,
  resolveStepUpState,
  phrasesMatch,
  buildStepUpMeta,
  verifyStepUpAuth,
  stepUpClientFields,
  coachActionErrorBody,
  stepUpRequiredError,
  loadSharedConfig,
};
