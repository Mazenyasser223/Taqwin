/* eslint-disable no-console */
/**
 * Verify athlete home payload for RESET_ATHLETE_EMAIL or latest complete athlete.
 */
require('dotenv').config({ override: true });

const http = require('http');
const https = require('https');
const { prisma } = require('../src/db');
const { loadDashboardTodayPlanContext } = require('../src/lib/plans/dashboardTodayPlan');
const { isAthleteOnboardingFullyComplete } = require('../src/lib/plans/onboardingComplete');

async function findAthlete() {
  const email = (process.env.RESET_ATHLETE_EMAIL || 'magdyzeyad54@gmail.com').trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email, role: 'athlete' },
    include: { profile: true },
  });
  if (!user) throw new Error(`Athlete not found: ${email}`);
  return user;
}

function requestJson(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      u,
      { method, headers: { 'Content-Type': 'application/json', ...headers } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const port = process.env.PORT || 4002;
  const base = `http://127.0.0.1:${port}`;
  const athlete = await findAthlete();
  const od = athlete.profile?.onboardingData || {};

  console.log('Athlete:', athlete.email);
  console.log('Onboarding complete:', isAthleteOnboardingFullyComplete(od));

  const dashCtx = await loadDashboardTodayPlanContext(athlete.id, new Date(), 'ar');
  console.log('DB today context:', dashCtx
    ? {
        meals: dashCtx.meals.length,
        exercises: dashCtx.exercises.length,
        isRest: dashCtx.isRest,
        targets: dashCtx.targets,
      }
    : null);

  if (!process.env.VERIFY_HOME_PASSWORD) {
    console.log('\nSKIP HTTP — set VERIFY_HOME_PASSWORD to test GET /api/dashboard/athlete/home');
    return;
  }

  const login = await requestJson(`${base}/api/auth/login`, {
    method: 'POST',
    body: { email: athlete.email, password: process.env.VERIFY_HOME_PASSWORD },
  });
  const token = login.body?.token;
  if (!token) {
    throw new Error(`Login failed (${login.status}): ${JSON.stringify(login.body)}`);
  }

  const home = await requestJson(`${base}/api/dashboard/athlete/home`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (home.status !== 200) throw new Error(`Home failed: ${home.status}`);

  const h = home.body;
  console.log('\nHTTP home summary:');
  console.log({
    todayDate: h.today?.date,
    nutritionLogs: h.today?.nutrition?.logCount,
    todayPlan: Boolean(h.todayPlan),
    todayWorkout: h.todayWorkout?.exercisesCount,
    todayDietMeals: h.todayDiet?.meals?.length,
    dietTodayMeals: h.analytics?.dietToday?.meals?.length,
    workoutExercises: h.analytics?.todayWorkoutPlan?.exercises?.length,
    isRest: h.analytics?.todayWorkoutPlan?.isRest,
    nextAction: h.nextAction?.slice(0, 60),
  });
}

main()
  .catch((e) => {
    console.error('FAIL:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
