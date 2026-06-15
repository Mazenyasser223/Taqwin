/**
 * Login + gym dashboard smoke — run while backend is on PORT (default 4002).
 * Usage: node scripts/test-gym-login-flow.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const owner = await prisma.user.findFirst({
    where: { role: 'gym' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  assert(owner, 'No gym owner in DB');

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: owner.email, password: 'Taqwin#2025', rememberMe: true }),
  });
  const loginBody = await loginRes.json();
  assert(loginRes.status === 200 && loginBody.token, `login failed: ${loginRes.status} ${JSON.stringify(loginBody)}`);
  console.log('✓ POST /api/auth/login', owner.email);

  const headers = { Authorization: `Bearer ${loginBody.token}` };
  const dashRes = await fetch(`${BASE}/api/dashboard/gym`, { headers });
  const dash = await dashRes.json();
  assert(dashRes.ok && dash.hasGym, `dashboard/gym failed: ${dashRes.status}`);
  console.log('✓ GET /api/dashboard/gym', dash.gym?.name);

  const staffRes = await fetch(`${BASE}/api/gyms/${dash.gym.id}/staff`, { headers });
  assert(staffRes.ok, `staff list failed: ${staffRes.status}`);
  const staff = await staffRes.json();
  console.log('✓ GET /api/gyms/:id/staff', Array.isArray(staff) ? staff.length : 0, 'members');

  console.log('\nGym login flow OK.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
