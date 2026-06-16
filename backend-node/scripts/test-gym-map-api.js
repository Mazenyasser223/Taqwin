/**
 * Test gym map coordinates — list gyms with lat/lng, owner update, athlete read.
 * Usage: node scripts/test-gym-map-api.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;
const PASSWORD = 'Taqwin#2025';

const GYM_OWNERS = [
  'iron.house@taqwin.app',
  'pulse.fit@taqwin.app',
  'flow.studio@taqwin.app',
];
const ATHLETE = 'demo@taqwin.app';

async function login(email) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, rememberMe: true }),
  });
  const body = await res.json();
  if (!res.ok || !body.token) throw new Error(`Login failed for ${email}: ${body.error || res.status}`);
  return body.token;
}

async function api(token, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log('=== Gym map API test ===\n');

  const athleteToken = await login(ATHLETE);
  const listRes = await api(athleteToken, 'GET', '/api/gyms');
  assert(listRes.status === 200, `GET /api/gyms expected 200 got ${listRes.status}`);
  assert(Array.isArray(listRes.data), 'GET /api/gyms should return array');

  const withCoords = listRes.data.filter(
    (g) => typeof g.latitude === 'number' && typeof g.longitude === 'number',
  );
  console.log(`Athlete sees ${listRes.data.length} gyms, ${withCoords.length} with coordinates`);
  assert(withCoords.length >= 3, `Expected at least 3 gyms with coordinates, got ${withCoords.length}`);

  for (const email of GYM_OWNERS) {
    const token = await login(email);
    const user = await prisma.user.findUnique({ where: { email } });
    const gym = await prisma.gym.findFirst({ where: { ownerId: user.id } });
    assert(gym, `No gym for ${email}`);

    const patchRes = await api(token, 'PATCH', `/api/gyms/${gym.id}`, {
      latitude: gym.latitude ?? 30.05,
      longitude: gym.longitude ?? 31.25,
      location: gym.location,
    });
    assert(patchRes.status === 200, `PATCH gym for ${email} failed: ${patchRes.status} ${JSON.stringify(patchRes.data)}`);
    assert(
      typeof patchRes.data.latitude === 'number' && typeof patchRes.data.longitude === 'number',
      `PATCH response missing coordinates for ${email}`,
    );
    console.log(`✓ ${email} — ${patchRes.data.name} @ ${patchRes.data.latitude}, ${patchRes.data.longitude}`);
  }

  const owner0 = await prisma.user.findUnique({ where: { email: GYM_OWNERS[0] } });
  const gym0 = await prisma.gym.findFirst({ where: { ownerId: owner0.id } });
  const badRes = await api(await login(GYM_OWNERS[0]), 'PATCH', `/api/gyms/${gym0.id}`, {
    latitude: 30.1,
  });
  assert(badRes.status === 400, 'Partial lat/lng should return 400');

  console.log('\nAll gym map API checks passed.');
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
