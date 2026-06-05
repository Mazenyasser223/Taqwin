#!/usr/bin/env node
/**
 * End-to-end Block C verification for one athlete (API + DB + Claude source).
 *
 *   node scripts/verify-block-c-e2e.js [email]
 */
require('dotenv').config({ override: true });

const { prisma } = require('../src/db');
const { loadDashboardTodayPlanContext, loadDashboardWeekPlanContext } = require('../src/lib/plans/dashboardTodayPlan');
const { resolveTodayPlan } = require('../src/lib/plans/dailyAthletePlanService');
const { getWeeklyReviewStatus } = require('../src/lib/adaptation/weeklyReview');
const { isAthleteOnboardingFullyComplete } = require('../src/lib/plans/onboardingComplete');
const { buildContextBundle } = require('../src/lib/contextBundle');
const { calendarDateOnly } = require('../src/lib/plans/planCalendar');
const { weekStartSundayUtc } = require('../src/lib/plans/planWeek');

const email = process.argv[2] || 'magdyzeyad54@gmail.com';
const API = process.env.API_BASE || `http://localhost:${process.env.PORT || 4002}`;

const checks = [];

function pass(name, detail) {
  checks.push({ name, ok: true, detail });
  console.log(`PASS  ${name}`, detail ? `— ${detail}` : '');
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail });
  console.error(`FAIL  ${name}`, detail ? `— ${detail}` : '');
}

async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

async function main() {
  console.log('=== Block C E2E verify ===');
  console.log('User:', email);
  console.log('API:', API);
  console.log('FEATURE_PLAN_REQUIRE_AI:', process.env.FEATURE_PLAN_REQUIRE_AI);
  console.log('FEATURE_AI_VIA_FASTAPI:', process.env.FEATURE_AI_VIA_FASTAPI);
  console.log('');

  try {
    const health = await fetchJson(`${API}/health`);
    if (health.status === 200 && health.body?.status) {
      pass('C0 API health', health.body.status);
    } else {
      fail('C0 API health', `status ${health.status}`);
    }
  } catch (e) {
    fail('C0 API health', `offline — ${e.message}`);
  }

  try {
    const aiHealth = await fetchJson(`${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/health`);
    if (aiHealth.status === 200) pass('C1 ai-service health', 'ok');
    else fail('C1 ai-service health', `status ${aiHealth.status}`);
  } catch (e) {
    fail('C1 ai-service health', `offline — ${e.message}`);
  }

  const user = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      profile: { select: { onboardingData: true, updatedAt: true } },
      settings: { select: { timezone: true, language: true } },
    },
  });

  if (!user) {
    fail('User exists', email);
    process.exit(1);
  }
  pass('User found', user.id);

  const onboardingOk = isAthleteOnboardingFullyComplete(user.profile?.onboardingData);
  if (onboardingOk) pass('C4 onboarding complete', '');
  else fail('C4 onboarding complete', 'questionnaire incomplete');

  const [workoutPlan, dietPlan] = await Promise.all([
    prisma.workoutPlan.findFirst({
      where: { userId: user.id, status: 'active' },
      orderBy: { weekStart: 'desc' },
      include: {
        days: {
          orderBy: { dayIndex: 'asc' },
          include: { exercises: { select: { id: true } } },
        },
      },
    }),
    prisma.dietPlan.findFirst({
      where: { userId: user.id, status: 'active' },
      orderBy: { weekStart: 'desc' },
      include: { days: { orderBy: { dayIndex: 'asc' }, include: { meals: true } } },
    }),
  ]);

  if (!workoutPlan && !dietPlan) {
    fail('C2 active Postgres plan', 'none');
  } else {
    const src =
      workoutPlan?.legacySource ||
      dietPlan?.legacySource ||
      workoutPlan?.source ||
      dietPlan?.source ||
      '?';
    const explainFull = workoutPlan?.explainabilityText || dietPlan?.explainabilityText || '';
    const explain = explainFull.slice(0, 120);
    if (
      src === 'ai' ||
      src === 'onboarding' ||
      String(explain).includes('Claude') ||
      String(explain).includes('ذكاء') ||
      String(explain).includes('الذكاء')
    ) {
      pass('C2 Claude/AI plan source', `legacySource=${src}`);
    } else if (process.env.FEATURE_PLAN_REQUIRE_AI === 'true') {
      fail('C2 Claude/AI plan source', `legacySource=${src} (require AI enabled)`);
    } else {
      pass('C2 plan source', `legacySource=${src}`);
    }

    const trainingDays = (workoutPlan?.days || []).filter((d) => !d.isRestDay);
    const maxEx = Math.max(0, ...trainingDays.map((d) => d.exercises?.length || 0));
    const meals = (dietPlan?.days || []).flatMap((d) => d.meals || []);
    if (trainingDays.length >= 2 && maxEx >= 2) pass('C2 workout template', `${trainingDays.length} days, max ${maxEx} ex`);
    else fail('C2 workout template', `days=${trainingDays.length} maxEx=${maxEx}`);
    if (meals.length >= 7) pass('C2 diet template', `${meals.length} meals`);
    else fail('C2 diet template', `meals=${meals.length}`);

    const ws = workoutPlan?.weekStart || dietPlan?.weekStart;
    if (ws) {
      const wsIso = ws.toISOString().slice(0, 10);
      const sun = weekStartSundayUtc(new Date()).toISOString().slice(0, 10);
      const profileUpdated = user.profile?.updatedAt?.toISOString().slice(0, 10);
      console.log(`INFO  plan weekStart=${wsIso} calendarSunday=${sun} profileUpdated=${profileUpdated}`);
      if (workoutPlan?.source === 'onboarding' || dietPlan?.source === 'onboarding') {
        const tz = user.settings?.timezone || 'UTC';
        const onboardDay = user.profile?.updatedAt
          ? calendarDateOnly(user.profile.updatedAt, tz).toISOString().slice(0, 10)
          : null;
        const todayIso = calendarDateOnly(new Date(), tz).toISOString().slice(0, 10);
        if (onboardDay && (wsIso === onboardDay || wsIso === todayIso)) {
          pass('C4 week starts on onboarding/first day', wsIso);
        } else if (onboardDay && wsIso === sun && onboardDay !== sun) {
          fail(
            'C4 week starts on onboarding day',
            `plan weekStart=${wsIso} but onboarding≈${onboardDay} — run: npm run regenerate:claude-plan -- ${email}`
          );
        } else {
          pass('C4 plan weekStart stored', wsIso);
        }
      }
    }
  }

  const todayCtx = await loadDashboardTodayPlanContext(user.id);
  const weekCtx = await loadDashboardWeekPlanContext(user.id);
  if (todayCtx?.formatted) pass('C6/C7 today plan API', todayCtx.formatted.planSource || 'postgres');
  else fail('C6/C7 today plan API', 'no today plan');
  if (weekCtx?.workout?.days?.length) pass('C6/C7 week plan API', `${weekCtx.workout.days.length} workout days`);
  else fail('C6/C7 week plan API', 'empty week');

  const resolved = await resolveTodayPlan(user.id);
  if (resolved.ok) pass('C5 DailyAthletePlan today', resolved.date?.toISOString?.().slice(0, 10) || '');
  else fail('C5 DailyAthletePlan today', resolved.reason || '');

  const bundle = await buildContextBundle(user.id);
  if (bundle?.profile) pass('A5 CAG context bundle', `locale=${bundle.locale}`);
  else fail('A5 CAG context bundle', 'empty');

  const review = await getWeeklyReviewStatus(user.id, {
    locale: user.settings?.language === 'en' ? 'en' : 'ar',
  });
  pass('C9 weekly adaptation status', `due=${review.due} preview=${review.preview?.decision}`);

  const dailyCount = await prisma.dailyAthletePlan.count({
    where: { userId: user.id },
  });
  if (dailyCount >= 1) pass('C11 daily rows', String(dailyCount));
  else fail('C11 daily rows', '0');

  const failed = checks.filter((c) => !c.ok);
  console.log('');
  console.log(`Result: ${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    console.log('Failed:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
