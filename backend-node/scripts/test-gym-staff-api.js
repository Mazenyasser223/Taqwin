/**
 * Gym staff API — run while backend is on PORT (default 4002).
 * Usage: node scripts/test-gym-staff-api.js
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
      data: { ownerId: gymOwner.id, name: 'Staff Test Gym', location: 'Cairo', maxCapacity: 50 },
    });
  }

  const ownerToken = jwt.sign({ sub: gymOwner.id, role: 'gym' }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  const name = `Test Staff ${Date.now()}`;
  const email = `staff.${Date.now()}@test.local`;
  const { res: createRes, json: created } = await api(`/api/gyms/${gym.id}/staff`, ownerToken, {
    method: 'POST',
    body: JSON.stringify({
      fullName: name,
      email,
      phone: '01000000000',
      role: 'trainer',
      baseSalary: 6000,
      workingHours: [
        { day: 1, start: '09:00', end: '17:00' },
        { day: 2, start: '09:00', end: '17:00' },
      ],
    }),
  });
  assert(createRes.status === 201, `create staff failed: ${createRes.status} ${JSON.stringify(created)}`);
  assert(created.email === email, 'email not saved');
  console.log('✓ POST /staff', created.id, created.email);

  const { res: listRes, json: staffList } = await api(`/api/gyms/${gym.id}/staff`, ownerToken);
  assert(listRes.ok, `list staff failed: ${listRes.status}`);
  assert(Array.isArray(staffList) && staffList.some((row) => row.id === created.id), 'created staff not in list');
  console.log('✓ GET /staff', staffList.length, 'members');

  const now = new Date();
  const { res: payRes, json: payResult } = await api(
    `/api/gyms/${gym.id}/staff/${created.id}/pay`,
    ownerToken,
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'salary',
        provider: 'mock',
        periodMonth: now.getMonth() + 1,
        periodYear: now.getFullYear(),
        bonusAmount: 200,
      }),
    },
  );
  assert(payRes.status === 201, `pay salary failed: ${payRes.status} ${JSON.stringify(payResult)}`);
  assert(payResult.requiresConfirm === true, 'mock pay should require confirm');
  console.log('✓ POST /pay (mock pending)', payResult.payout.id);

  const { res: confirmRes, json: confirmed } = await api(
    `/api/gyms/${gym.id}/staff/${created.id}/pay/${payResult.payout.id}/confirm`,
    ownerToken,
    { method: 'POST', body: '{}' },
  );
  assert(confirmRes.ok, `confirm pay failed: ${confirmRes.status}`);
  assert(confirmed.payout.status === 'paid', 'payout should be paid');
  console.log('✓ POST /pay/confirm');

  const { res: bonusRes, json: bonusResult } = await api(
    `/api/gyms/${gym.id}/staff/${created.id}/pay`,
    ownerToken,
    {
      method: 'POST',
      body: JSON.stringify({ type: 'bonus', provider: 'cash', bonusOnlyAmount: 150 }),
    },
  );
  assert(bonusRes.status === 201, `bonus failed: ${bonusRes.status}`);
  assert(bonusResult.payout.status === 'paid', 'cash bonus should be instant paid');
  console.log('✓ POST /pay bonus (cash)');

  const { res: exportRes, json: exportBody } = await api(
    `/api/gyms/${gym.id}/staff/payroll/export?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
    ownerToken,
  );
  assert(exportRes.ok, `export failed: ${exportRes.status}`);
  const csvText = typeof exportBody === 'string' ? exportBody : JSON.stringify(exportBody);
  assert(csvText.includes('Staff Name'), 'CSV header missing');
  assert(csvText.includes('Email'), 'CSV email column missing');
  console.log('✓ GET /payroll/export');

  const { res: delRes } = await api(`/api/gyms/${gym.id}/staff/${created.id}`, ownerToken, {
    method: 'DELETE',
  });
  assert(delRes.ok, `deactivate failed: ${delRes.status}`);
  console.log('✓ DELETE /staff (deactivate)');

  console.log('\nAll gym staff API checks passed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
