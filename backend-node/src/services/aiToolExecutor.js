/**
 * Block A4 — execute AI tools in Node (Prisma writes) and audit to AiToolExecution.
 * FastAPI must never touch Postgres directly.
 */
const { prisma } = require('../db');
const { logger } = require('../lib/logger');
const { buildNutritionDay, resolveAthleteTimezone } = require('../lib/athleteMetrics');
const { calendarDateOnly } = require('../lib/plans/planCalendar');
const { resolveTodayPlan } = require('../lib/plans/dailyAthletePlanService');
const { getOrCreateUserSettings } = require('../lib/userSettings');
const { invalidateContextBundle } = require('../lib/contextBundle');
const { invalidateDashboardForUser } = require('../lib/dashboardCache');
const { recordPlanChange } = require('../lib/adaptation/planChangeLog');
const { formatWorkoutDay } = require('../lib/plans/planApiFormat');
const {
  parseGramsFromText,
  parseLifeModeFromText,
  resolveFoodForLog,
  resolveReplaceExerciseInputs,
  resolveExerciseByName,
  VALID_LIFE_MODES,
  DEFAULT_GRAMS,
} = require('../lib/aiToolResolvers');
const { runMidWeekCheck } = require('../lib/adaptation/midWeekTriggers');
const { applyMicroPatch } = require('../lib/adaptation/applyAdaptation');
const { enqueueMemoryAfterTool } = require('../lib/ai/memoryEvents');
const { EXTENDED_TOOL_HANDLERS } = require('../lib/aiToolHandlersExtended');

function assertUuid(value, fieldName) {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new Error(`${fieldName} must be a valid UUID`);
  }
}

function assertPositiveGrams(grams) {
  const n = Number(grams);
  if (!Number.isFinite(n) || n <= 0 || n > 5000) {
    throw new Error('grams must be a positive number up to 5000');
  }
  return n;
}

/** @type {Record<string, (ctx: { userId: string, input: object, threadId?: string }) => Promise<object>>} */
const TOOL_HANDLERS = {
  /** Connectivity / contract check for internal API wiring. */
  async ping() {
    return { ok: true, service: 'taqwin-api', block: 'A4' };
  },

  /** Echo payload for integration tests. */
  async echo({ input }) {
    return { echoed: input ?? {} };
  },

  async get_nutrition_today({ userId }) {
    const timezone = await resolveAthleteTimezone(userId);
    const dateKey = calendarDateOnly(new Date(), timezone).toISOString().slice(0, 10);
    return buildNutritionDay(userId, dateKey, timezone);
  },

  async get_workout_today({ userId }) {
    const resolved = await resolveTodayPlan(userId);
    if (!resolved.ok) throw new Error('No active plan for today');

    const day = resolved.dailyPlan?.workoutPlanDay;
    const workout = formatWorkoutDay(day);
    const dateKey = resolved.date.toISOString().slice(0, 10);

    return {
      date: dateKey,
      dayIndex: resolved.dayIndex,
      ...workout,
    };
  },

  async log_food({ userId, input = {} }) {
    let { foodItemId, grams, loggedAt, rawText, message, foodName, matchConfidence } = input;

    if (!foodItemId) {
      const query = foodName || rawText || message || '';
      const resolved = await resolveFoodForLog(query);
      if (!resolved) {
        throw new Error(`Could not match food from: "${String(query).slice(0, 80)}"`);
      }
      if (resolved.needsDisambiguation) {
        return {
          disambiguation: {
            kind: 'food',
            candidates: resolved.candidates,
            grams: resolved.grams,
          },
        };
      }
      foodItemId = resolved.foodItemId;
      if (grams == null) grams = resolved.grams;
      if (matchConfidence == null) matchConfidence = resolved.matchConfidence;
      foodName = resolved.foodName;
      input.matchConfidence = matchConfidence;
      input.foodItemId = foodItemId;
      input.foodName = foodName;
    }

    if (grams == null) {
      grams = parseGramsFromText(rawText || message || '') ?? DEFAULT_GRAMS;
    }

    assertUuid(foodItemId, 'foodItemId');
    const gramsValue = assertPositiveGrams(grams);

    const food = await prisma.foodItem.findUnique({ where: { id: foodItemId } });
    if (!food) throw new Error('Food item not found');

    let loggedAtDate;
    if (loggedAt != null) {
      loggedAtDate = new Date(loggedAt);
      if (Number.isNaN(loggedAtDate.getTime())) {
        throw new Error('loggedAt must be a valid ISO datetime');
      }
    }

    const log = await prisma.foodLog.create({
      data: {
        userId,
        foodItemId,
        grams: gramsValue,
        ...(loggedAtDate ? { loggedAt: loggedAtDate } : {}),
      },
      include: {
        foodItem: {
          select: {
            id: true,
            name: true,
            calories: true,
            protein: true,
            carbs: true,
            fat: true,
          },
        },
      },
    });

    const settings = await getOrCreateUserSettings(userId);
    void invalidateDashboardForUser(userId, settings?.timezone || 'UTC').catch(() => null);
    void invalidateContextBundle(userId).catch(() => null);

    return { log };
  },

  async replace_exercise_today({ userId, input = {} }) {
    let { oldExerciseId, newExerciseId, exerciseIndex, sets, reps, reason, request, message } = input;

    if (!newExerciseId) {
      const text = request || message || '';
      const { newExerciseName, oldExerciseName } = input;
      if (newExerciseName) {
        const found = await resolveExerciseByName(newExerciseName);
        if (found) newExerciseId = found.id;
      }
      if (text.trim() || oldExerciseName) {
        const resolved = await resolveReplaceExerciseInputs(
          userId,
          oldExerciseName && newExerciseName
            ? `replace ${oldExerciseName} with ${newExerciseName}`
            : text
        );
        oldExerciseId = oldExerciseId || resolved.oldExerciseId;
        newExerciseId = newExerciseId || resolved.newExerciseId;
        exerciseIndex = exerciseIndex ?? resolved.exerciseIndex;
        reason = reason || resolved.reason;
      }
    }

    if (!newExerciseId) throw new Error('newExerciseId is required');
    assertUuid(newExerciseId, 'newExerciseId');
    if (oldExerciseId != null) assertUuid(oldExerciseId, 'oldExerciseId');

    const resolved = await resolveTodayPlan(userId);
    if (!resolved.ok) throw new Error('No active plan for today');

    const dayId = resolved.dailyPlan?.workoutPlanDayId;
    if (!dayId) throw new Error('Today has no workout planned');

    const exercises = await prisma.workoutPlanExercise.findMany({
      where: { dayId },
      orderBy: { sortOrder: 'asc' },
      include: { exercise: { select: { id: true, name: true, nameAr: true } } },
    });

    if (!exercises.length) throw new Error('No exercises on today\'s workout');

    let target = null;
    if (oldExerciseId) {
      target = exercises.find((row) => row.exerciseId === oldExerciseId);
    } else if (exerciseIndex != null) {
      const idx = Number(exerciseIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= exercises.length) {
        throw new Error('exerciseIndex out of range');
      }
      target = exercises[idx];
    } else {
      target = exercises[0];
    }

    if (!target) throw new Error('Exercise to replace not found on today\'s plan');

    const newExercise = await prisma.exercise.findFirst({
      where: { id: newExerciseId, isPublic: true },
      select: { id: true, name: true, nameAr: true, category: true },
    });
    if (!newExercise) throw new Error('Replacement exercise not found');

    const updateData = { exerciseId: newExercise.id };
    if (sets != null) {
      const setsNum = Number(sets);
      if (!Number.isInteger(setsNum) || setsNum < 1 || setsNum > 50) {
        throw new Error('sets must be an integer between 1 and 50');
      }
      updateData.sets = setsNum;
    }
    if (reps != null) {
      updateData.reps = String(reps).slice(0, 32);
    }

    const updated = await prisma.workoutPlanExercise.update({
      where: { id: target.id },
      data: updateData,
      include: { exercise: { select: { id: true, name: true, nameAr: true, category: true } } },
    });

    await prisma.dailyAthletePlan.update({
      where: { userId_date: { userId, date: resolved.date } },
      data: {
        status: 'adapted',
        adaptedFromProgress: true,
        aiNotes: reason?.slice(0, 500) || null,
      },
    });

    const settings = await getOrCreateUserSettings(userId);
    const locale = settings?.language === 'en' ? 'en' : 'ar';
    const dateKey = resolved.date.toISOString().slice(0, 10);

    await recordPlanChange({
      userId,
      changeType: 'exercise_swap',
      reason: reason || `Replaced ${target.exercise?.name || 'exercise'} with ${newExercise.name}`,
      triggeredBy: 'chat',
      beforeSummary: {
        date: dateKey,
        exerciseId: target.exerciseId,
        exerciseName: target.exercise?.name,
      },
      afterSummary: {
        date: dateKey,
        exerciseId: newExercise.id,
        exerciseName: newExercise.name,
      },
      locale,
      notify: true,
    });

    void invalidateContextBundle(userId).catch(() => null);

    return {
      ok: true,
      date: dateKey,
      replaced: {
        id: target.exerciseId,
        name: target.exercise?.name,
      },
      exercise: updated.exercise,
      sets: updated.sets,
      reps: updated.reps,
    };
  },

  async set_life_mode({ userId, input = {} }) {
    let { lifeMode, message, reason } = input;
    const text = message || reason || '';

    if (!lifeMode) {
      lifeMode = parseLifeModeFromText(text);
    }
    if (!lifeMode || !VALID_LIFE_MODES.includes(lifeMode)) {
      throw new Error(
        'Could not detect life mode — try travel, sick, fasting, injury_flare, or normal'
      );
    }

    const settings = await getOrCreateUserSettings(userId);
    const timezone = settings?.timezone || 'UTC';
    const locale = settings?.language === 'en' ? 'en' : 'ar';
    const resolved = await resolveTodayPlan(userId);
    const dateOnly = resolved.ok ? resolved.date : calendarDateOnly(new Date(), timezone);
    const noteReason = String(reason || message || '').slice(0, 500);

    const row = await prisma.dailyAthletePlan.upsert({
      where: { userId_date: { userId, date: dateOnly } },
      create: {
        userId,
        date: dateOnly,
        status: 'adapted',
        lifeMode,
        adaptedFromProgress: true,
        aiNotes: noteReason || null,
      },
      update: {
        lifeMode,
        status: 'adapted',
        adaptedFromProgress: true,
        aiNotes: noteReason || null,
      },
    });

    const dateKey = dateOnly.toISOString().slice(0, 10);
    await recordPlanChange({
      userId,
      changeType: 'life_mode',
      reason: noteReason || `life_mode:${lifeMode}`,
      triggeredBy: 'chat',
      afterSummary: { date: dateKey, lifeMode: row.lifeMode },
      locale,
      notify: true,
    });

    void invalidateContextBundle(userId).catch(() => null);
    void invalidateDashboardForUser(userId, timezone).catch(() => null);

    return { ok: true, date: dateKey, lifeMode: row.lifeMode };
  },

  async adapt_plan({ userId, input = {} }) {
    const text = String(input.message || input.request || '').trim();
    const settings = await getOrCreateUserSettings(userId);
    const locale = settings?.language === 'en' ? 'en' : 'ar';
    const timezone = settings?.timezone || 'UTC';
    const explain =
      text.slice(0, 300) ||
      (locale === 'ar' ? 'تعديل الخطة من المحادثة' : 'Plan tweak from chat');

    const mid = await runMidWeekCheck(userId, { locale, timezone });
    if (mid.applied) {
      void invalidateContextBundle(userId).catch(() => null);
      void invalidateDashboardForUser(userId, timezone).catch(() => null);
      return mid;
    }

    const micro = await applyMicroPatch(userId, {
      locale,
      timezone,
      signals: { painReports: /pain|injury|hurt|ألم|إصابة/i.test(text) ? 1 : 0 },
      explain,
    });

    await recordPlanChange({
      userId,
      changeType: 'manual_edit',
      reason: explain,
      triggeredBy: 'chat',
      afterSummary: micro,
      locale,
      notify: true,
    });

    void invalidateContextBundle(userId).catch(() => null);
    void invalidateDashboardForUser(userId, timezone).catch(() => null);

    return { applied: true, mode: 'micro', ...micro };
  },

  ...EXTENDED_TOOL_HANDLERS,
};

/**
 * @param {{ userId: string, toolName: string, input?: object, threadId?: string }} params
 * @returns {Promise<{ success: boolean, output: object | null, error: string | null, executionId: string }>}
 */
async function executeTool({ userId, toolName, input = {}, threadId }) {
  const started = Date.now();
  let success = false;
  let output = null;
  let error = null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new Error('User not found');
    }

    const handler = TOOL_HANDLERS[toolName];
    if (!handler) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    output = await handler({ userId, input, threadId });
    if (output?.disambiguation) {
      return {
        success: false,
        output: null,
        error: null,
        disambiguation: output.disambiguation,
        executionId: null,
      };
    }
    success = true;
    void enqueueMemoryAfterTool({ userId, toolName }).catch(() => null);
  } catch (err) {
    error = err.message || 'Tool execution failed';
    logger.debug({ err, toolName, userId }, 'AI tool execution failed');
  }

  const durationMs = Math.max(1, Date.now() - started);

  const row = await prisma.aiToolExecution.create({
    data: {
      userId,
      threadId: threadId || null,
      toolName,
      input: {
        ...input,
      },
      output: success ? output : undefined,
      success,
      error,
      durationMs,
    },
  });

  return {
    success,
    output: success ? output : null,
    error,
    executionId: row.id,
  };
}

/** Not exposed to coach chat — use plan API or support flows instead. */
const CHAT_DISABLED_TOOLS = new Set([
  'generate_weekly_workout',
  'generate_weekly_diet',
  'request_booking',
  'search_trainers',
]);

function listStubTools() {
  return Object.keys(TOOL_HANDLERS);
}

function listChatTools() {
  return Object.keys(TOOL_HANDLERS).filter(
    (name) => !CHAT_DISABLED_TOOLS.has(name) && name !== 'ping' && name !== 'echo'
  );
}

module.exports = {
  executeTool,
  listStubTools,
  listChatTools,
  CHAT_DISABLED_TOOLS,
  TOOL_HANDLERS,
};
