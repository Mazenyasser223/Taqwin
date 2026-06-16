/**
 * Gym subscription plans + reception plan assignment — run while backend is on PORT (default 4002).
 * Usage: node scripts/test-gym-plans-api.js
 */
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;

async function api(path, token, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const gymOwner = await prisma.user.findFirst({
    where: { role: 'gym' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  assert(gymOwner, 'No gym owner in DB');

  let gym = await prisma.gym.findFirst({ where: { ownerId: gymOwner.id } });
  if (!gym) {
    gym = await prisma.gym.create({
      data: { ownerId: gymOwner.id, name: 'Plans Test Gym', location: 'Cairo', maxCapacity: 50 },
    });
  }

  const ownerToken = jwt.sign({ sub: gymOwner.id, role: 'gym' }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  const planName = `Test Plan ${Date.now()}`;
  const { res: createRes, json: created } = await api(`/api/gyms/${gym.id}/plans`, ownerToken, {
    method: 'POST',
    body: JSON.stringify({
      name: planName,
      nameAr: 'خطة تجريبية',
      durationDays: 30,
      price: 750,
      benefits: { freezeWeeks: 2, invitations: 3, privateCoachSessions: 4 },
    }),
  });
  assert(createRes.status === 201, `create plan failed: ${createRes.status} ${JSON.stringify(created)}`);
  assert(created.benefits?.freezeWeeks === 2, 'benefits.freezeWeeks missing');
  assert(created.benefits?.invitations === 3, 'benefits.invitations missing');
  assert(created.benefits?.privateCoachSessions === 4, 'benefits.privateCoachSessions missing');
  console.log('✓ POST /plans with benefits', created.id);

  const { res: listRes, json: plans } = await api(`/api/gyms/${gym.id}/plans`, ownerToken);
  assert(listRes.ok, `list plans failed: ${listRes.status}`);
  assert(Array.isArray(plans) && plans.some((p) => p.id === created.id), 'created plan not in list');
  console.log('✓ GET /plans', plans.length, 'active plans');

  const { res: dashRes, json: dash } = await api('/api/dashboard/gym', ownerToken);
  assert(dashRes.ok, `dashboard gym failed: ${dashRes.status}`);
  assert(dash.hasGym === true, 'dashboard hasGym expected');
  assert(Array.isArray(dash.plans), 'dashboard plans array missing');
  const dashPlan = dash.plans.find((p) => p.id === created.id);
  assert(dashPlan, 'plan missing from dashboard');
  assert(dashPlan.benefits?.freezeWeeks === 2, 'dashboard plan benefits missing');
  assert(typeof dash.totals?.monthRevenue === 'number', 'monthRevenue missing');
  console.log('✓ GET /dashboard/gym plans + revenue', { monthRevenue: dash.totals.monthRevenue });

  const newEmail = `plan-test-${Date.now()}@example.com`;
  const { res: regRes, json: reg } = await api(`/api/gyms/${gym.id}/reception/register`, ownerToken, {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Plan',
      lastName: 'Tester',
      email: newEmail,
      planId: created.id,
      paymentMethod: 'cash',
    }),
  });
  assert(regRes.status === 201, `register with plan failed: ${regRes.status} ${JSON.stringify(reg)}`);
  assert(reg.member?.userId, 'member userId missing');
  assert(reg.member?.planId === created.id, 'member planId not set');
  assert(reg.member?.expiresAt, 'member expiresAt not set');
  console.log('✓ POST /reception/register with planId', {
    userId: reg.member.userId,
    expiresAt: reg.member.expiresAt,
  });

  const memberUserId = reg.member.userId;
  const { res: patchRes, json: patched } = await api(
    `/api/gyms/${gym.id}/reception/members/${memberUserId}/membership`,
    ownerToken,
    {
      method: 'PATCH',
      body: JSON.stringify({
        planId: created.id,
        paymentMethod: 'card',
      }),
    },
  );
  assert(patchRes.ok, `patch membership failed: ${patchRes.status} ${JSON.stringify(patched)}`);
  assert(patched.planId === created.id, 'patched planId mismatch');
  assert(patched.paymentMethod === 'card', 'patched paymentMethod mismatch');
  console.log('✓ PATCH /reception/members/:id/membership');

  const { res: detailRes, json: detail } = await api(
    `/api/gyms/${gym.id}/reception/members/${memberUserId}`,
    ownerToken,
  );
  assert(detailRes.ok, `member detail failed: ${detailRes.status}`);
  assert(detail.plan?.id === created.id, 'detail plan missing');
  assert(detail.plan?.benefits?.invitations === 3, 'detail plan benefits missing');
  console.log('✓ GET /reception/members/:id includes plan benefits');

  const { res: delRes, json: deactivated } = await api(
    `/api/gyms/${gym.id}/plans/${created.id}`,
    ownerToken,
    { method: 'DELETE' },
  );
  assert(delRes.ok, `deactivate plan failed: ${delRes.status}`);
  assert(deactivated.isActive === false, 'plan should be inactive');
  console.log('✓ DELETE /plans/:planId (soft deactivate)');

  console.log('\nAll gym plans API checks passed.');
}

main()
  .catch((e) => {
    console.error('\nFAILED:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
