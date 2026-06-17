/**
 * Smoke test basic sessions API.
 * Usage: node scripts/test-gym-basic-sessions-api.js
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;

async function main() {
  const owner = await prisma.user.findFirst({
    where: { role: 'gym' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  if (!owner) throw new Error('Gym owner not found');

  const gym = await prisma.gym.findFirst({ where: { ownerId: owner.id }, select: { id: true, name: true } });
  if (!gym) throw new Error('Gym not found');

  const token = jwt.sign({ sub: owner.id, role: 'gym' }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
  const headers = { Authorization: `Bearer ${token}` };
  const listRes = await fetch(`${BASE}/api/gyms/${gym.id}/basic-sessions`, { headers });
  const listBody = await listRes.json();
  if (!listRes.ok) throw new Error(`GET basic-sessions failed: ${listRes.status} ${JSON.stringify(listBody)}`);

  console.log('✓ GET /api/gyms/:id/basic-sessions', listBody.length, 'sessions for', gym.name);
  for (const s of listBody) {
    console.log(`  - ${s.type}: ${s.name} @ ${s.price} EGP (active=${s.isActive})`);
  }

  const todayRes = await fetch(`${BASE}/api/gyms/${gym.id}/basic-sessions/bookings/today`, { headers });
  const todayBody = await todayRes.json();
  if (!todayRes.ok) throw new Error(`GET bookings/today failed: ${todayRes.status}`);

  console.log('✓ GET bookings/today:', todayBody.length, 'bookings');
  console.log('\nBasic sessions API OK.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
