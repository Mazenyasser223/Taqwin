/**
 * Coach plan — AI or rule-generated workout + diet templates with per-day manual overrides.
 * Stored on Profile.onboardingData.coachPlan (editable without losing user logs).
 */
const { z } = require('zod');
const { logger } = require('./logger');
const { completeChat, resolveProvider } = require('../services/aiChatProvider');
const {
  buildAthletePersonalization,
  buildDailyMealPlan,
  defaultWorkoutExercises,
  enrichDailyMealPlanWithDbMacros,
  enrichTodayWorkoutExercises,
  estimateTargets,
  trainingDayIndexes,
  parseTrainingDays,
  localizeValue,
} = require('./athletePersonalization');

const exerciseSchema = z.object({
  exerciseId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  nameAr: z.string().max(200).optional(),
  sets: z.number().int().min(1).max(50).default(3),
  reps: z.number().int().min(1).max(500).default(10),
  category: z.string().max(80).optional(),
  difficulty: z.string().max(40).optional(),
});

const RULES_PLAN_HORIZON_WEEKS = 2;
const AI_DEFAULT_PLAN_HORIZON_WEEKS = 4;

const weekScheduleSchema = z.array(
  z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    isTrainingDay: z.boolean(),
    splitLabel: z.string().nullable().optional(),
    exercises: z.array(exerciseSchema),
  })
);

const coachPlanSchema = z.object({
  version: z.literal(1),
  source: z.enum(['rules', 'ai', 'manual']),
  generatedAt: z.string(),
  locale: z.enum(['en', 'ar']).default('ar'),
  aiSummary: z.string().max(2000).optional().nullable(),
  /** Total weeks in plan (week 0 = current calendar week). Rules default 2 (= 1 week ahead). */
  planHorizonWeeks: z.number().int().min(1).max(8).optional(),
  weeks: z
    .array(
      z.object({
        weekIndex: z.number().int().min(0).max(7),
        weeklySchedule: weekScheduleSchema,
        diet: z
          .object({
            slots: z.array(z.record(z.unknown())),
          })
          .optional(),
      })
    )
    .optional(),
  workout: z.object({
    title: z.string(),
    durationMin: z.number().int().min(10).max(180),
    weeklySchedule: z.array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        isTrainingDay: z.boolean(),
        splitLabel: z.string().nullable().optional(),
        exercises: z.array(exerciseSchema),
      })
    ),
  }),
  diet: z.object({
    mealsPerDay: z.number().int().min(1).max(8),
    mainMeals: z.number().int().optional(),
    snacks: z.number().int().optional(),
    planTotalCalories: z.number().int().optional(),
    slots: z.array(z.record(z.unknown())),
  }),
  overrides: z
    .object({
      workoutByDate: z.record(z.array(exerciseSchema)).optional(),
      dietByDate: z.record(z.object({ slots: z.array(z.record(z.unknown())) })).optional(),
      dietSlots: z.array(z.record(z.unknown())).optional(),
    })
    .optional(),
});

function getCoachPlanFromOnboarding(onboardingData) {
  if (!onboardingData || typeof onboardingData !== 'object') return null;
  const raw = onboardingData.coachPlan;
  if (!raw || typeof raw !== 'object') return null;
  const parsed = coachPlanSchema.safeParse(raw);
  if (!parsed.success) return null;
  const plan = parsed.data;
  if (!plan.planHorizonWeeks || !plan.weeks?.length) return attachPlanHorizon(plan);
  return plan;
}

function shouldGenerateCoachPlan(onboardingData) {
  if (!onboardingData || typeof onboardingData !== 'object') return false;
  if (onboardingData.coachPlan?.generatedAt && !onboardingData.coachPlanForceRegenerate) return false;
  return Boolean(onboardingData.workoutPlanCompletedAt && onboardingData.dietPlanCompletedAt);
}

async function saveCoachPlanToProfile(prisma, userId, coachPlan) {
  const profile = await prisma.athleteProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profile not found');
  const od =
    profile.onboardingData && typeof profile.onboardingData === 'object'
      ? { ...profile.onboardingData }
      : {};
  delete od.coachPlanForceRegenerate;
  od.coachPlan = coachPlan;
  await prisma.athleteProfile.update({
    where: { userId },
    data: { onboardingData: od },
  });
  return coachPlan;
}

function buildWeeklySchedule(profile, exercises, locale) {
  const od =
    profile?.onboardingData && typeof profile.onboardingData === 'object'
      ? profile.onboardingData
      : {};
  const daysPerWeek = parseTrainingDays(od.trainingDaysPerWeek);
  const trainIdx = new Set(trainingDayIndexes(daysPerWeek));
  const split = localizeValue(od.preferredSplit, locale);
  const schedule = [];
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    const isTrainingDay = trainIdx.has(dayOfWeek);
    schedule.push({
      dayOfWeek,
      isTrainingDay,
      splitLabel: isTrainingDay ? split : null,
      exercises: isTrainingDay
        ? exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            name: ex.name,
            nameAr: ex.nameAr,
            sets: ex.sets ?? 3,
            reps: ex.reps ?? 10,
            category: ex.category,
            difficulty: ex.difficulty,
          }))
        : [],
    });
  }
  return schedule;
}

function calendarWeekStart(dateKey) {
  const dow = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function daysBetweenKeys(fromDateKey, toDateKey) {
  const from = new Date(`${fromDateKey}T12:00:00Z`).getTime();
  const to = new Date(`${toDateKey}T12:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

function weekOffsetForDate(todayKey, dateKey) {
  const todayStart = calendarWeekStart(todayKey);
  const dateStart = calendarWeekStart(dateKey);
  return Math.floor(daysBetweenKeys(todayStart, dateStart) / 7);
}

function cloneWeeklySchedule(schedule) {
  return schedule.map((d) => ({
    ...d,
    exercises: (d.exercises ?? []).map((ex) => ({ ...ex })),
  }));
}

function attachPlanHorizon(plan) {
  const horizon =
    plan.source === 'ai'
      ? Math.min(8, Math.max(2, Number(plan.planHorizonWeeks) || AI_DEFAULT_PLAN_HORIZON_WEEKS))
      : RULES_PLAN_HORIZON_WEEKS;

  const baseSchedule = plan.workout?.weeklySchedule ?? [];
  const aiWeeks = Array.isArray(plan.weeks) ? plan.weeks : [];
  const weeks = [];

  for (let i = 0; i < horizon; i += 1) {
    const fromAi = aiWeeks.find((w) => Number(w.weekIndex) === i);
    weeks.push({
      weekIndex: i,
      weeklySchedule: fromAi?.weeklySchedule?.length
        ? fromAi.weeklySchedule
        : cloneWeeklySchedule(baseSchedule),
      diet: fromAi?.diet?.slots?.length ? fromAi.diet : undefined,
    });
  }

  return {
    ...plan,
    planHorizonWeeks: horizon,
    weeks,
    workout: {
      ...plan.workout,
      weeklySchedule: weeks[0]?.weeklySchedule ?? baseSchedule,
    },
  };
}

function maxFutureWeekOffsetForPlan(coachPlan) {
  if (!coachPlan) return 1;
  const horizon = coachPlan.planHorizonWeeks ?? RULES_PLAN_HORIZON_WEEKS;
  return Math.max(0, horizon - 1);
}

function extractJsonBlock(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) return raw.slice(start, end + 1);
  return raw;
}

async function tryEnhancePlanWithAi(rulePlan, profile, targets, locale) {
  if (!resolveProvider()) return null;
  const system = `You are Taqwin's plan generator. Reply with ONLY valid JSON (no markdown).
Shape:
{
  "aiSummary": "2 sentences in ${locale === 'ar' ? 'Egyptian Arabic' : 'English'}",
  "planHorizonWeeks": 2-4,
  "weeks": [
    { "weekIndex": 0, "weeklySchedule": [{ "dayOfWeek": 0-6, "isTrainingDay": boolean, "splitLabel": string|null, "exercises": [{ "name": string, "sets": number, "reps": number }] }] },
    { "weekIndex": 1, "weeklySchedule": [...] }
  ],
  "workout": { "title": string, "durationMin": number, "weeklySchedule": (week 0 schedule) },
  "diet": { "slots": [{ "id": string, "label": string, "kind": "meal"|"snack", "items": [{ "name": string, "category": string, "grams": number }] }] }
}
planHorizonWeeks = how many calendar weeks the athlete can scroll forward (2-4). Include one weeklySchedule per week index. Keep the same training day pattern unless progression needs small changes. Do not invent foods not in the input diet slots. Max 5 exercises per training day.`;

  const user = JSON.stringify({
    locale,
    targets,
    rulePlan: {
      workout: rulePlan.workout,
      diet: { slots: rulePlan.diet.slots?.map((s) => ({ id: s.id, label: s.label, kind: s.kind, items: s.items })) },
    },
    profile: {
      goal: profile.fitnessGoal,
      weight: profile.weight,
      height: profile.height,
      level: profile.fitnessLevel,
    },
  });

  try {
    const raw = await completeChat({
      system,
      messages: [{ role: 'user', content: user }],
    });
    const parsed = JSON.parse(extractJsonBlock(raw));
    const merged = {
      ...rulePlan,
      source: 'ai',
      aiSummary: typeof parsed.aiSummary === 'string' ? parsed.aiSummary.slice(0, 2000) : null,
      workout: {
        ...rulePlan.workout,
        title: parsed.workout?.title || rulePlan.workout.title,
        durationMin: Number(parsed.workout?.durationMin) || rulePlan.workout.durationMin,
        weeklySchedule: Array.isArray(parsed.workout?.weeklySchedule)
          ? parsed.workout.weeklySchedule.map((d, i) => ({
              dayOfWeek: Number(d.dayOfWeek ?? i),
              isTrainingDay: Boolean(d.isTrainingDay),
              splitLabel: d.splitLabel ?? null,
              exercises: Array.isArray(d.exercises)
                ? d.exercises.map((ex) => ({
                    name: String(ex.name || 'Exercise'),
                    nameAr: ex.nameAr,
                    sets: Math.min(50, Math.max(1, Number(ex.sets) || 3)),
                    reps: Math.min(500, Math.max(1, Number(ex.reps) || 10)),
                  }))
                : rulePlan.workout.weeklySchedule[i]?.exercises ?? [],
            }))
          : rulePlan.workout.weeklySchedule,
      },
      diet: {
        ...rulePlan.diet,
        slots: Array.isArray(parsed.diet?.slots) ? parsed.diet.slots : rulePlan.diet.slots,
      },
      planHorizonWeeks: Number(parsed.planHorizonWeeks) || AI_DEFAULT_PLAN_HORIZON_WEEKS,
      weeks: Array.isArray(parsed.weeks) ? parsed.weeks : undefined,
    };
    const valid = coachPlanSchema.safeParse(merged);
    return valid.success ? attachPlanHorizon(valid.data) : null;
  } catch (err) {
    logger.warn({ err }, 'AI coach plan enhancement failed, using rules');
    return null;
  }
}

async function buildRuleCoachPlan(prisma, profile, locale = 'ar') {
  const targets = estimateTargets(profile);
  const personalization = buildAthletePersonalization(profile, locale);
  const baseExercises = defaultWorkoutExercises(profile?.fitnessGoal, profile?.onboardingData, locale);
  const enrichedExercises = await enrichTodayWorkoutExercises(prisma, baseExercises);
  let dietPlan = buildDailyMealPlan(profile, targets, locale);
  dietPlan = await enrichDailyMealPlanWithDbMacros(prisma, dietPlan);

  return {
    version: 1,
    source: 'rules',
    generatedAt: new Date().toISOString(),
    locale,
    aiSummary: null,
    workout: {
      title: personalization.planTitle,
      durationMin: personalization.workoutDurationMin,
      weeklySchedule: buildWeeklySchedule(profile, enrichedExercises, locale),
    },
    diet: dietPlan,
    overrides: { workoutByDate: {}, dietByDate: {} },
  };
}

async function generateAndPersistCoachPlan(prisma, userId, locale = 'ar', { force = false } = {}) {
  const profile = await prisma.athleteProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profile not found');
  const od =
    profile.onboardingData && typeof profile.onboardingData === 'object'
      ? profile.onboardingData
      : {};
  if (!force && !shouldGenerateCoachPlan(od)) {
    const existing = getCoachPlanFromOnboarding(od);
    if (existing) return existing;
  }

  let plan = attachPlanHorizon(await buildRuleCoachPlan(prisma, profile, locale));
  const targets = estimateTargets(profile);
  const aiPlan = await tryEnhancePlanWithAi(plan, profile, targets, locale);
  if (aiPlan) plan = aiPlan;

  return saveCoachPlanToProfile(prisma, userId, plan);
}

function scheduleForWeekOffset(coachPlan, weekOffset) {
  const weeks = coachPlan.weeks;
  if (Array.isArray(weeks) && weeks.length) {
    const entry = weeks.find((w) => w.weekIndex === weekOffset) ?? weeks[0];
    return entry?.weeklySchedule ?? coachPlan.workout.weeklySchedule;
  }
  return coachPlan.workout.weeklySchedule;
}

function resolveWorkoutForDate(coachPlan, dateKey, todayKey = dateKey) {
  if (!coachPlan) return null;
  const overrides = coachPlan.overrides?.workoutByDate?.[dateKey];
  if (Array.isArray(overrides) && overrides.length) return overrides;

  const offset = weekOffsetForDate(todayKey, dateKey);
  if (offset > maxFutureWeekOffsetForPlan(coachPlan)) return [];

  const schedule = scheduleForWeekOffset(coachPlan, Math.max(0, offset));
  const dow = new Date(`${dateKey}T12:00:00Z`).getUTCDay();
  const day = schedule?.find((d) => d.dayOfWeek === dow);
  if (!day?.isTrainingDay) return [];
  return day.exercises ?? [];
}

function resolveDietForDate(coachPlan, dateKey, todayKey = dateKey) {
  if (!coachPlan) return null;
  const dayOverride = coachPlan.overrides?.dietByDate?.[dateKey];
  if (dayOverride?.slots?.length) return { ...coachPlan.diet, slots: dayOverride.slots };
  if (coachPlan.overrides?.dietSlots?.length) {
    return { ...coachPlan.diet, slots: coachPlan.overrides.dietSlots };
  }

  const offset = weekOffsetForDate(todayKey, dateKey);
  if (offset > maxFutureWeekOffsetForPlan(coachPlan)) return null;

  const weekEntry = coachPlan.weeks?.find((w) => w.weekIndex === Math.max(0, offset));
  if (weekEntry?.diet?.slots?.length) {
    return { ...coachPlan.diet, slots: weekEntry.diet.slots };
  }
  return coachPlan.diet;
}

function mergeCoachPlanPatch(existing, patch) {
  const next = { ...existing, overrides: { ...existing.overrides } };
  if (patch.workoutDayOverride) {
    const { date, exercises } = patch.workoutDayOverride;
    next.overrides.workoutByDate = { ...(next.overrides.workoutByDate || {}), [date]: exercises };
    next.source = 'manual';
  }
  if (patch.dietDayOverride) {
    const { date, slots } = patch.dietDayOverride;
    next.overrides.dietByDate = { ...(next.overrides.dietByDate || {}), [date]: { slots } };
    next.source = 'manual';
  }
  if (patch.dietSlots?.length) {
    next.overrides.dietSlots = patch.dietSlots;
    next.diet = { ...next.diet, slots: patch.dietSlots };
    next.source = 'manual';
  }
  if (patch.workoutWeeklySchedule?.length) {
    next.workout = { ...next.workout, weeklySchedule: patch.workoutWeeklySchedule };
    next.source = 'manual';
  }
  if (patch.aiSummary != null) next.aiSummary = patch.aiSummary;
  next.generatedAt = new Date().toISOString();
  return next;
}

async function applyCoachPlanPatch(prisma, userId, patch) {
  const profile = await prisma.athleteProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profile not found');
  let plan = getCoachPlanFromOnboarding(profile.onboardingData);
  if (!plan) {
    plan = await buildRuleCoachPlan(prisma, profile, patch.locale || 'ar');
  }
  const merged = mergeCoachPlanPatch(plan, patch);
  const valid = coachPlanSchema.safeParse(merged);
  if (!valid.success) throw new Error('Invalid coach plan patch');
  return saveCoachPlanToProfile(prisma, userId, attachPlanHorizon(valid.data));
}

function coachPlanMeta(coachPlan) {
  if (!coachPlan) {
    return {
      hasPlan: false,
      source: null,
      generatedAt: null,
      planHorizonWeeks: RULES_PLAN_HORIZON_WEEKS,
      futureWeeksAhead: 1,
    };
  }
  const horizon = coachPlan.planHorizonWeeks ?? RULES_PLAN_HORIZON_WEEKS;
  return {
    hasPlan: true,
    source: coachPlan.source,
    generatedAt: coachPlan.generatedAt,
    aiSummary: coachPlan.aiSummary ?? null,
    editable: true,
    planHorizonWeeks: horizon,
    futureWeeksAhead: maxFutureWeekOffsetForPlan(coachPlan),
    weeks: (coachPlan.weeks ?? []).map((w) => ({
      weekIndex: w.weekIndex,
      weeklySchedule: (w.weeklySchedule ?? []).map((d) => ({
        dayOfWeek: d.dayOfWeek,
        isTrainingDay: d.isTrainingDay,
        splitLabel: d.splitLabel ?? null,
      })),
    })),
  };
}

module.exports = {
  coachPlanSchema,
  exerciseSchema,
  getCoachPlanFromOnboarding,
  shouldGenerateCoachPlan,
  generateAndPersistCoachPlan,
  saveCoachPlanToProfile,
  resolveWorkoutForDate,
  resolveDietForDate,
  applyCoachPlanPatch,
  mergeCoachPlanPatch,
  coachPlanMeta,
  buildRuleCoachPlan,
  attachPlanHorizon,
  maxFutureWeekOffsetForPlan,
  weekOffsetForDate,
  scheduleForWeekOffset,
  RULES_PLAN_HORIZON_WEEKS,
};
