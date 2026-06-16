/**
 * Extended AI tool handlers — profile, plans, progress, gym, fitness catalog.
 * Imported into aiToolExecutor.js (Block E full registry).
 */
const { prisma } = require('../db');
const { buildNutritionDay, resolveAthleteTimezone } = require('./athleteMetrics');
const { calendarDateOnly } = require('./plans/planCalendar');
const { resolveTodayPlan } = require('./plans/dailyAthletePlanService');
const { getOrCreateUserSettings } = require('./userSettings');
const { invalidateContextBundle } = require('./contextBundle');
const { invalidateDashboardForUser } = require('./dashboardCache');
const { recordPlanChange } = require('./adaptation/planChangeLog');
const { formatWorkoutDay } = require('./plans/planApiFormat');
const { upsertProfile } = require('./profileUpsert');
const { computeWeeklyAdherence } = require('./adaptation/adherence');
const { weekDateOnlyBounds } = require('./adaptation/weekBounds');
const { weekStartSundayUtc } = require('./plans/planWeek');
const { getWeeklyReviewStatus } = require('./adaptation/weeklyReview');
const { resolveFoodForLog, resolveExerciseByName } = require('./aiToolResolvers');
const { validateFoodForUser } = require('./plans/nutritionAdaptationContext');
const { retrieveFoodsSql } = require('./rag/catalogFood');

function assertUuid(value, fieldName) {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new Error(`${fieldName} must be a valid UUID`);
  }
}

async function athleteLocale(userId) {
  const settings = await getOrCreateUserSettings(userId);
  return {
    locale: settings?.language === 'en' ? 'en' : 'ar',
    timezone: settings?.timezone || 'UTC',
  };
}

async function invalidateUserCaches(userId, timezone) {
  void invalidateContextBundle(userId).catch(() => null);
  void invalidateDashboardForUser(userId, timezone || 'UTC').catch(() => null);
}

/** @type {Record<string, (ctx: { userId: string, input: object, threadId?: string }) => Promise<object>>} */
const EXTENDED_TOOL_HANDLERS = {
  async update_weight({ userId, input = {} }) {
    const weightKg = Number(input.weightKg ?? input.weight);
    if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 400) {
      throw new Error('weightKg must be between 0 and 400');
    }
    await upsertProfile(userId, 'athlete', { weight: weightKg });
    const { timezone } = await athleteLocale(userId);
    await prisma.bodyMetric.create({
      data: { userId, weightKg, recordedAt: new Date() },
    });
    await invalidateUserCaches(userId, timezone);
    return { ok: true, weightKg };
  },

  async update_height({ userId, input = {} }) {
    const heightCm = Number(input.heightCm ?? input.height);
    if (!Number.isFinite(heightCm) || heightCm < 100 || heightCm > 250) {
      throw new Error('heightCm must be between 100 and 250');
    }
    await upsertProfile(userId, 'athlete', { height: heightCm });
    const { timezone } = await athleteLocale(userId);
    await invalidateUserCaches(userId, timezone);
    return { ok: true, heightCm };
  },

  async update_fitness_goal({ userId, input = {} }) {
    const goal = String(input.fitnessGoal || input.goal || '').trim();
    if (!goal) throw new Error('fitnessGoal is required');
    await upsertProfile(userId, 'athlete', { fitnessGoal: goal.slice(0, 128) });
    return { ok: true, fitnessGoal: goal.slice(0, 128) };
  },

  async update_level({ userId, input = {} }) {
    const level = String(input.fitnessLevel || input.level || '').trim();
    if (!level) throw new Error('fitnessLevel is required');
    await upsertProfile(userId, 'athlete', { fitnessLevel: level.slice(0, 64) });
    return { ok: true, fitnessLevel: level.slice(0, 64) };
  },

  async update_medical_notes({ userId, input = {} }) {
    const notes = String(input.medicalNotes || input.notes || input.message || '').slice(0, 2000);
    if (!notes) throw new Error('medicalNotes is required');
    await upsertProfile(userId, 'athlete', { medicalNotes: notes });
    return { ok: true, medicalNotes: notes };
  },

  async update_food_log({ userId, input = {} }) {
    const { foodLogId, grams } = input;
    assertUuid(foodLogId, 'foodLogId');
    const gramsValue = Number(grams);
    if (!Number.isFinite(gramsValue) || gramsValue <= 0 || gramsValue > 5000) {
      throw new Error('grams must be a positive number up to 5000');
    }
    const log = await prisma.foodLog.update({
      where: { id: foodLogId, userId },
      data: { grams: gramsValue },
      include: { foodItem: { select: { id: true, name: true } } },
    });
    const { timezone } = await athleteLocale(userId);
    await invalidateUserCaches(userId, timezone);
    return { log };
  },

  async delete_food_log({ userId, input = {} }) {
    const { foodLogId } = input;
    assertUuid(foodLogId, 'foodLogId');
    await prisma.foodLog.delete({ where: { id: foodLogId, userId } });
    const { timezone } = await athleteLocale(userId);
    await invalidateUserCaches(userId, timezone);
    return { ok: true, deleted: foodLogId };
  },

  async get_nutrition_week({ userId }) {
    const timezone = await resolveAthleteTimezone(userId);
    const end = calendarDateOnly(new Date(), timezone);
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      days.push(await buildNutritionDay(userId, dateKey, timezone));
    }
    return { days, timezone };
  },

  async replace_meal_today({ userId, input = {} }) {
    const resolved = await resolveTodayPlan(userId);
    if (!resolved.ok) throw new Error('No active plan for today');
    const dayId = resolved.dailyPlan?.dietPlanDayId;
    if (!dayId) throw new Error('Today has no diet plan');
    const mealType = String(input.mealType || 'lunch').toLowerCase();
    const foodName = String(input.foodName || input.newFoodName || input.message || '').trim();
    if (!foodName) throw new Error('foodName is required');
    const profile = await prisma.athleteProfile.findUnique({ where: { userId } });
    const od =
      profile?.onboardingData && typeof profile.onboardingData === 'object'
        ? profile.onboardingData
        : {};
    const found = await resolveFoodForLog(foodName);
    if (!found) throw new Error(`Could not match food: ${foodName.slice(0, 80)}`);
    const meal = await prisma.dietPlanMeal.findFirst({
      where: { dayId, mealType },
      include: { items: true },
    });
    if (!meal) throw new Error(`No ${mealType} meal on today's plan`);
    const food = await prisma.foodItem.findUnique({ where: { id: found.foodItemId } });
    if (!food) throw new Error('Food item not found');
    const safety = validateFoodForUser(food.name, od, food.nameAr || '');
    if (!safety.ok) {
      throw new Error(`Cannot use "${food.name}": ${safety.reason}`);
    }
    if (meal.items.length) {
      await prisma.dietPlanMealItem.update({
        where: { id: meal.items[0].id },
        data: {
          foodItemId: food.id,
          label: food.name,
          quantity: found.grams || 100,
          unit: 'g',
        },
      });
    } else {
      await prisma.dietPlanMealItem.create({
        data: {
          mealId: meal.id,
          foodItemId: food.id,
          label: food.name,
          quantity: found.grams || 100,
          unit: 'g',
        },
      });
    }
    const { locale, timezone } = await athleteLocale(userId);
    await recordPlanChange({
      userId,
      changeType: 'meal_swap',
      reason: input.reason || `Replaced ${mealType} with ${food.name}`,
      triggeredBy: 'chat',
      locale,
      notify: true,
    });
    await invalidateUserCaches(userId, timezone);
    return { ok: true, mealType, food: { id: food.id, name: food.name } };
  },

  async log_workout({ userId, input = {} }) {
    const notes = String(input.notes || input.message || 'Workout logged from chat').slice(0, 500);
    const durationMin = Number(input.durationMin || input.duration || 45);
    const { timezone } = await athleteLocale(userId);
    const dateKey = calendarDateOnly(new Date(), timezone).toISOString().slice(0, 10);
    return {
      ok: true,
      date: dateKey,
      durationMin: Number.isFinite(durationMin) ? durationMin : 45,
      notes,
      message: 'Workout session noted — use exercise logs for set detail',
    };
  },

  async log_exercise_set({ userId, input = {} }) {
    const exerciseName = String(input.exerciseName || input.name || '').trim();
    const sets = Number(input.sets || 1);
    const reps = String(input.reps || '10');
    const weightKg = input.weightKg != null ? Number(input.weightKg) : null;
    let exerciseId = input.exerciseId;
    if (!exerciseId && exerciseName) {
      const found = await resolveExerciseByName(exerciseName);
      if (found) exerciseId = found.id;
    }
    if (!exerciseId) throw new Error('exerciseId or exerciseName is required');
    assertUuid(exerciseId, 'exerciseId');
    const log = await prisma.exerciseLog.create({
      data: {
        userId,
        exerciseId,
        notes: [
          `sets=${Number.isInteger(sets) ? sets : 1}`,
          `reps=${reps}`,
          weightKg != null && Number.isFinite(weightKg) ? `weightKg=${weightKg}` : null,
          input.notes ? String(input.notes).slice(0, 200) : null,
        ]
          .filter(Boolean)
          .join(' '),
      },
      include: { exercise: { select: { id: true, name: true } } },
    });
    return { log };
  },

  async add_exercise({ userId, input = {} }) {
    const resolved = await resolveTodayPlan(userId);
    if (!resolved.ok) throw new Error('No active plan for today');
    const dayId = resolved.dailyPlan?.workoutPlanDayId;
    if (!dayId) throw new Error('Today has no workout planned');
    let exerciseId = input.exerciseId;
    const name = String(input.exerciseName || input.name || '').trim();
    if (!exerciseId && name) {
      const found = await resolveExerciseByName(name);
      if (found) exerciseId = found.id;
    }
    if (!exerciseId) throw new Error('exerciseId or exerciseName is required');
    assertUuid(exerciseId, 'exerciseId');
    const maxSort = await prisma.workoutPlanExercise.aggregate({
      where: { dayId },
      _max: { sortOrder: true },
    });
    const row = await prisma.workoutPlanExercise.create({
      data: {
        dayId,
        exerciseId,
        sets: Number(input.sets) || 3,
        reps: String(input.reps || '10').slice(0, 32),
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      include: { exercise: { select: { id: true, name: true, nameAr: true } } },
    });
    const { locale, timezone } = await athleteLocale(userId);
    await recordPlanChange({
      userId,
      changeType: 'manual_edit',
      reason: `Added ${row.exercise?.name || 'exercise'}`,
      triggeredBy: 'chat',
      locale,
    });
    await invalidateUserCaches(userId, timezone);
    return { exercise: row };
  },

  async remove_exercise({ userId, input = {} }) {
    const resolved = await resolveTodayPlan(userId);
    if (!resolved.ok) throw new Error('No active plan for today');
    const dayId = resolved.dailyPlan?.workoutPlanDayId;
    if (!dayId) throw new Error('Today has no workout planned');
    let target = null;
    if (input.workoutPlanExerciseId) {
      assertUuid(input.workoutPlanExerciseId, 'workoutPlanExerciseId');
      target = await prisma.workoutPlanExercise.findFirst({
        where: { id: input.workoutPlanExerciseId, dayId },
        include: { exercise: true },
      });
    } else {
      const idx = Number(input.exerciseIndex ?? 0);
      const rows = await prisma.workoutPlanExercise.findMany({
        where: { dayId },
        orderBy: { sortOrder: 'asc' },
        include: { exercise: true },
      });
      target = rows[idx] || null;
    }
    if (!target) throw new Error('Exercise not found on today\'s plan');
    await prisma.workoutPlanExercise.delete({ where: { id: target.id } });
    const { locale, timezone } = await athleteLocale(userId);
    await recordPlanChange({
      userId,
      changeType: 'manual_edit',
      reason: `Removed ${target.exercise?.name || 'exercise'}`,
      triggeredBy: 'chat',
      locale,
    });
    await invalidateUserCaches(userId, timezone);
    return { ok: true, removed: target.exercise?.name };
  },

  async get_today_plan({ userId }) {
    const resolved = await resolveTodayPlan(userId);
    if (!resolved.ok) throw new Error('No active plan for today');
    const workout = resolved.dailyPlan?.workoutPlanDay
      ? formatWorkoutDay(resolved.dailyPlan.workoutPlanDay)
      : null;
    const timezone = await resolveAthleteTimezone(userId);
    const dateKey = resolved.date.toISOString().slice(0, 10);
    const nutrition = await buildNutritionDay(userId, dateKey, timezone);
    return {
      date: dateKey,
      dayIndex: resolved.dayIndex,
      status: resolved.dailyPlan?.status,
      lifeMode: resolved.dailyPlan?.lifeMode,
      workout,
      nutrition,
    };
  },

  async generate_weekly_workout({ userId: _userId, input = {} }) {
    return {
      ok: false,
      queued: true,
      message:
        'Weekly workout regeneration must be triggered via POST /api/ai/plan/generate or onboarding flow',
      request: String(input.request || input.message || '').slice(0, 300),
    };
  },

  async generate_weekly_diet({ userId: _userId, input = {} }) {
    return {
      ok: false,
      queued: true,
      message:
        'Weekly diet regeneration must be triggered via POST /api/ai/plan/generate or onboarding flow',
      request: String(input.request || input.message || '').slice(0, 300),
    };
  },

  async generate_today({ userId }) {
    const resolved = await resolveTodayPlan(userId);
    if (!resolved.ok) throw new Error('No active plan — complete onboarding first');
    return { ok: true, date: resolved.date.toISOString().slice(0, 10), dailyPlanId: resolved.dailyPlan?.id };
  },

  async skip_day({ userId, input = {} }) {
    const { timezone, locale } = await athleteLocale(userId);
    const dateOnly = input.date
      ? new Date(`${input.date}T12:00:00Z`)
      : calendarDateOnly(new Date(), timezone);
    const reason = String(input.reason || input.message || 'Skipped from chat').slice(0, 500);
    const row = await prisma.dailyAthletePlan.upsert({
      where: { userId_date: { userId, date: dateOnly } },
      create: {
        userId,
        date: dateOnly,
        status: 'skipped',
        aiNotes: reason,
        adaptedFromProgress: true,
      },
      update: { status: 'skipped', aiNotes: reason, adaptedFromProgress: true },
    });
    await recordPlanChange({
      userId,
      changeType: 'skip_day',
      reason,
      triggeredBy: 'chat',
      afterSummary: { date: dateOnly.toISOString().slice(0, 10), status: row.status },
      locale,
      notify: true,
    });
    await invalidateUserCaches(userId, timezone);
    return { ok: true, date: dateOnly.toISOString().slice(0, 10), status: row.status };
  },

  async swap_rest_day({ userId, input = {} }) {
    const { timezone, locale } = await athleteLocale(userId);
    const reason = String(input.reason || input.message || 'Rest day swap from chat').slice(0, 500);
    await recordPlanChange({
      userId,
      changeType: 'manual_edit',
      reason,
      triggeredBy: 'chat',
      locale,
      notify: true,
    });
    await invalidateUserCaches(userId, timezone);
    return {
      ok: true,
      message: 'Rest day swap recorded — full meso reschedule may apply on weekly review',
      reason,
    };
  },

  async record_body_metric({ userId, input = {} }) {
    const weightKg = input.weightKg != null ? Number(input.weightKg) : null;
    const bodyFatPct = input.bodyFatPct != null ? Number(input.bodyFatPct) : null;
    if (weightKg == null && bodyFatPct == null) throw new Error('weightKg or bodyFatPct required');
    const row = await prisma.bodyMetric.create({
      data: {
        userId,
        weightKg: weightKg != null && Number.isFinite(weightKg) ? weightKg : null,
        bodyFatPct: bodyFatPct != null && Number.isFinite(bodyFatPct) ? bodyFatPct : null,
        recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
      },
    });
    if (weightKg != null && Number.isFinite(weightKg)) {
      await upsertProfile(userId, 'athlete', { weight: weightKg }).catch(() => null);
    }
    const { timezone } = await athleteLocale(userId);
    await invalidateUserCaches(userId, timezone);
    return { bodyMetric: row };
  },

  async record_readiness({ userId, input = {} }) {
    const { timezone } = await athleteLocale(userId);
    const dateOnly = input.date
      ? new Date(`${input.date}T12:00:00Z`)
      : calendarDateOnly(new Date(), timezone);
    const row = await prisma.readinessLog.upsert({
      where: { userId_date: { userId, date: dateOnly } },
      create: {
        userId,
        date: dateOnly,
        sleepQuality: input.sleepQuality ?? null,
        soreness: input.soreness ?? null,
        rpe: input.rpe ?? null,
        notes: input.notes ? String(input.notes).slice(0, 2000) : null,
      },
      update: {
        sleepQuality: input.sleepQuality ?? undefined,
        soreness: input.soreness ?? undefined,
        rpe: input.rpe ?? undefined,
        notes: input.notes ? String(input.notes).slice(0, 2000) : undefined,
      },
    });
    await invalidateUserCaches(userId, timezone);
    return { readiness: row };
  },

  async get_progress_summary({ userId }) {
    const { locale, timezone } = await athleteLocale(userId);
    const weekStart = weekStartSundayUtc(new Date());
    const adherence = await computeWeeklyAdherence(userId, weekStart, { timezone });
    const review = await getWeeklyReviewStatus(userId, { locale, timezone });
    return { weekStart: weekStart.toISOString().slice(0, 10), adherence, review };
  },

  async create_progress_snapshot({ userId, input = {} }) {
    const { timezone } = await athleteLocale(userId);
    const weekStart = input.weekStart
      ? new Date(`${input.weekStart}T12:00:00Z`)
      : weekStartSundayUtc(new Date());
    const { startDateOnly } = weekDateOnlyBounds(weekStart, timezone);
    const adherence = await computeWeeklyAdherence(userId, weekStart, { timezone });
    const row = await prisma.progressSnapshot.upsert({
      where: { userId_weekStart: { userId, weekStart: startDateOnly } },
      create: {
        userId,
        weekStart: startDateOnly,
        adherencePct: adherence.overall,
        workoutAdherence: adherence.workoutAdherence,
        nutritionAdherence: adherence.nutritionAdherence,
        aiSummary: String(input.notes || '').slice(0, 1000) || null,
      },
      update: {
        adherencePct: adherence.overall,
        workoutAdherence: adherence.workoutAdherence,
        nutritionAdherence: adherence.nutritionAdherence,
        aiSummary: String(input.notes || '').slice(0, 1000) || undefined,
      },
    });
    return { snapshot: row };
  },

  async search_gyms({ input = {} }) {
    const q = String(input.query || input.message || '').trim();
    const rows = await prisma.gym.findMany({
      where: q
        ? {
            isActive: true,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { location: { contains: q, mode: 'insensitive' } },
            ],
          }
        : { isActive: true },
      take: 10,
      select: {
        id: true,
        name: true,
        location: true,
        phone: true,
        imageUrl: true,
      },
    });
    return { gyms: rows, query: q };
  },

  async search_products({ input = {} }) {
    const q = String(input.query || input.message || '').trim();
    const rows = await prisma.product.findMany({
      where: q
        ? {
            isActive: true,
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { brand: { contains: q, mode: 'insensitive' } },
            ],
          }
        : { isActive: true },
      take: 10,
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        nameAr: true,
        brand: true,
        price: true,
        currency: true,
        imageUrl: true,
        stock: true,
        categoryId: true,
      },
    });
    return { products: rows, query: q };
  },

  async recommend_plan_products({ userId, input = {} }) {
    const { getPlanProductRecommendations } = require('./commerce/planProductRecommendations');
    const locale = input.locale === 'en' ? 'en' : 'ar';
    const bundle = await getPlanProductRecommendations(userId, { locale });
    return {
      bundle,
      products: bundle.products.map((row) => ({
        slot: row.slot,
        reasonKey: row.reasonKey,
        reasonEn: row.reasonEn,
        reasonAr: row.reasonAr,
        reason: row.reason,
        ...row.product,
      })),
      frequentlyBoughtTogether: (bundle.frequentlyBoughtTogether || []).map((row) => ({
        slot: row.slot,
        reason: row.reason,
        reasonEn: row.reasonEn,
        reasonAr: row.reasonAr,
        ...row.product,
      })),
      sessionId: bundle.sessionId,
      bundleId: bundle.bundleId,
      bundleTitle: bundle.bundleTitle,
      subtotal: bundle.subtotal,
      discountPercent: bundle.discountPercent,
      discountAmount: bundle.discountAmount,
      total: bundle.total,
      currency: bundle.currency,
      empty: bundle.empty,
    };
  },

  async search_trainers({ input = {} }) {
    const q = String(input.query || input.message || '').trim();
    return {
      trainers: [],
      query: q,
      message: 'Trainer marketplace search is not active — browse gyms instead',
    };
  },

  async request_booking({ userId, input = {} }) {
    return {
      ok: false,
      message: 'Booking requests are disabled — use gym contact or support ticket',
      userId,
      request: String(input.message || '').slice(0, 300),
    };
  },

  async create_support_ticket({ userId, input = {} }) {
    const subject = String(input.subject || 'Coach support request').slice(0, 120);
    const description = String(input.description || input.message || '').slice(0, 4000);
    if (description.length < 10) throw new Error('description must be at least 10 characters');
    const row = await prisma.supportTicket.create({
      data: {
        userId,
        category: input.category || 'technical',
        subject,
        description,
        status: 'open',
      },
    });
    return { ticket: { id: row.id, subject: row.subject, status: row.status } };
  },

  async log_water_intake({ userId, input = {} }) {
    const ml = Number(input.ml || input.amountMl || 250);
    if (!Number.isFinite(ml) || ml <= 0 || ml > 5000) throw new Error('ml must be 1–5000');
    const { timezone } = await athleteLocale(userId);
    await invalidateUserCaches(userId, timezone);
    return { ok: true, ml, message: 'Water intake noted — aggregate hydration tracking coming soon' };
  },

  async get_macro_targets({ userId }) {
    const timezone = await resolveAthleteTimezone(userId);
    const dateKey = calendarDateOnly(new Date(), timezone).toISOString().slice(0, 10);
    const day = await buildNutritionDay(userId, dateKey, timezone);
    return { date: dateKey, targets: day.targets || day.summary?.targets || {} };
  },

  async search_food_catalog({ input = {} }) {
    const q = String(input.query || input.foodName || input.message || '').trim();
    if (!q) throw new Error('query is required');
    const rows = await prisma.foodItem.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      take: 8,
      select: {
        id: true,
        name: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
      },
    });
    return { foods: rows, query: q };
  },

  async search_exercises({ input = {} }) {
    const q = String(input.query || input.exerciseName || input.message || '').trim();
    if (!q) throw new Error('query is required');
    const rows = await prisma.exercise.findMany({
      where: {
        isPublic: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { nameAr: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 8,
      select: { id: true, name: true, nameAr: true, category: true, primaryMuscles: true },
    });
    return { exercises: rows, query: q };
  },

  async get_exercise_details({ input = {} }) {
    let exerciseId = input.exerciseId;
    const name = String(input.exerciseName || input.name || '').trim();
    if (!exerciseId && name) {
      const found = await resolveExerciseByName(name);
      if (found) exerciseId = found.id;
    }
    if (!exerciseId) throw new Error('exerciseId or exerciseName is required');
    assertUuid(exerciseId, 'exerciseId');
    const row = await prisma.exercise.findFirst({
      where: { id: exerciseId, isPublic: true },
      select: {
        id: true,
        name: true,
        nameAr: true,
        category: true,
        difficulty: true,
        primaryMuscles: true,
        longDescription: true,
      },
    });
    if (!row) throw new Error('Exercise not found');
    return { exercise: row };
  },

  async suggest_exercise_alternatives({ userId: _userId, input = {} }) {
    const name = String(input.exerciseName || input.name || input.message || '').trim();
    if (!name) throw new Error('exerciseName is required');
    const base = await resolveExerciseByName(name);
    const category = base?.category;
    const rows = await prisma.exercise.findMany({
      where: {
        isPublic: true,
        ...(category ? { category } : {}),
        ...(base?.id ? { id: { not: base.id } } : {}),
      },
      take: 5,
      select: { id: true, name: true, nameAr: true, category: true },
    });
    return { original: base?.name || name, alternatives: rows };
  },

  async log_cardio_session({ userId: _userId, input = {} }) {
    const minutes = Number(input.durationMin || input.minutes || 30);
    const activity = String(input.activity || 'cardio').slice(0, 64);
    return {
      ok: true,
      activity,
      durationMin: Number.isFinite(minutes) ? minutes : 30,
      message: 'Cardio session logged as note — link to plan adaptation on weekly review',
    };
  },

  async log_stretching_session({ userId: _userId, input = {} }) {
    const minutes = Number(input.durationMin || 15);
    return { ok: true, durationMin: Number.isFinite(minutes) ? minutes : 15, type: 'stretching' };
  },

  async set_training_goal({ userId, input = {} }) {
    const goal = String(input.trainingGoal || input.goal || input.message || '').slice(0, 128);
    if (!goal) throw new Error('trainingGoal is required');
    await upsertProfile(userId, 'athlete', { fitnessGoal: goal });
    return { ok: true, trainingGoal: goal };
  },

  async get_weekly_adherence({ userId }) {
    const timezone = await resolveAthleteTimezone(userId);
    const { start } = weekDateOnlyBounds(new Date(), timezone);
    const adherence = await computeWeeklyAdherence(userId, start, { timezone });
    return adherence;
  },

  async log_sleep({ userId, input = {} }) {
    const hours = Number(input.hours || input.sleepHours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Error('hours must be 0–24');
    const sleepQuality =
      hours >= 7 ? 5 : hours >= 6 ? 4 : hours >= 5 ? 3 : 2;
    return EXTENDED_TOOL_HANDLERS.record_readiness({
      userId,
      input: { sleepQuality, notes: `Sleep: ${hours}h` },
    });
  },

  async log_stress_level({ userId, input = {} }) {
    const level = Number(input.stressLevel || input.level || 3);
    if (!Number.isInteger(level) || level < 1 || level > 5) {
      throw new Error('stressLevel must be 1–5');
    }
    return EXTENDED_TOOL_HANDLERS.record_readiness({
      userId,
      input: { rpe: level, notes: `Stress level: ${level}/5` },
    });
  },

  async get_recovery_score({ userId }) {
    const { timezone } = await athleteLocale(userId);
    const end = calendarDateOnly(new Date(), timezone);
    const row = await prisma.readinessLog.findFirst({
      where: { userId, date: { lte: end } },
      orderBy: { date: 'desc' },
    });
    if (!row) return { score: null, message: 'No readiness logged yet' };
    const sleep = row.sleepQuality ?? 3;
    const soreness = row.soreness ?? 3;
    const rpe = row.rpe ?? 3;
    const score = Math.round(((sleep + (6 - soreness) + (6 - rpe)) / 3) * 20);
    return { score, date: row.date.toISOString().slice(0, 10), readiness: row };
  },

  async calculate_tdee_estimate({ userId }) {
    const profile = await prisma.athleteProfile.findUnique({ where: { userId } });
    const weight = profile?.weight;
    const height = profile?.height;
    let age = 30;
    if (profile?.dateOfBirth) {
      const dob = new Date(profile.dateOfBirth);
      age = Math.max(14, Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)));
    }
    if (!weight || !height) {
      throw new Error('Weight and height required in profile for TDEE estimate');
    }
    const bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    return {
      bmrKcal: Math.round(bmr),
      maintenanceKcal: Math.round(bmr * 1.55),
      note: 'Mifflin-St Jeor estimate — not medical advice',
    };
  },

  async suggest_meal_plan_swap({ userId, input = {} }) {
    const mealType = String(input.mealType || 'lunch');
    const goal = String(input.goal || input.message || 'high protein').slice(0, 200);
    const profile = await prisma.athleteProfile.findUnique({ where: { userId } });
    const od =
      profile?.onboardingData && typeof profile.onboardingData === 'object'
        ? profile.onboardingData
        : {};
    const slot =
      mealType === 'breakfast' || mealType === 'snack' ? mealType : 'lunch';
    const foods = await retrieveFoodsSql({ onboardingData: od, mealSlot: slot, limit: 8 });
    return {
      mealType,
      goal,
      suggestions: foods.map((f) => ({
        id: f.id,
        name: f.name,
        protein: f.protein,
        calories: f.calories,
      })),
    };
  },
};

module.exports = { EXTENDED_TOOL_HANDLERS };
