/**
 * Smoke: new gym owner profile update auto-provisions gym + default plans.
 * Usage: node scripts/test-gym-provision-flow.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;
const TEST_EMAIL = `gym-provision-${Date.now()}@taqwin.test`;
const PASSWORD = 'Taqwin#2025';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      role: 'gym',
      profile: { create: {} },
    },
  });

  try {
    const loginRes = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: PASSWORD, rememberMe: true }),
    });
    const loginBody = await loginRes.json();
    assert(loginRes.ok && loginBody.token, `login failed: ${loginRes.status}`);
    const headers = {
      Authorization: `Bearer ${loginBody.token}`,
      'Content-Type': 'application/json',
    };

    let dashRes = await fetch(`${BASE}/api/dashboard/gym`, { headers });
    let dash = await dashRes.json();
    assert(dashRes.ok, 'dashboard/gym should respond');
    assert(!dash.hasGym, 'gym should not exist before profile business fields');

    const patchRes = await fetch(`${BASE}/api/profile`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        businessName: 'Provision Test Gym',
        businessAddress: 'Nasr City, Cairo',
        businessPhone: '+201012345678',
        onboardingData: {
          roleWizard: 'gym',
          completedAt: new Date().toISOString(),
          inProgress: false,
        },
      }),
    });
    assert(patchRes.ok, `profile patch failed: ${patchRes.status}`);

    dashRes = await fetch(`${BASE}/api/dashboard/gym`, { headers });
    dash = await dashRes.json();
    assert(dashRes.ok && dash.hasGym, 'gym should be provisioned after profile save');
    assert(dash.gym.name === 'Provision Test Gym', `name sync failed: ${dash.gym.name}`);

    const plans = await prisma.gymSubscriptionPlan.findMany({
      where: { gymId: dash.gym.id },
      orderBy: { sortOrder: 'asc' },
    });
    assert(plans.length >= 3, `expected default plans, got ${plans.length}`);

    console.log('✓ gym auto-provisioned:', dash.gym.id, dash.gym.name);
    console.log('✓ default plans:', plans.map((p) => p.name).join(', '));
    console.log('\nGym provision flow OK.');
  } finally {
    await prisma.gym.deleteMany({ where: { ownerId: user.id } });
    await prisma.profile.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
