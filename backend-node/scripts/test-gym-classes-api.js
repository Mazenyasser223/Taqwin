/**
 * Gym classes API — run while backend is on PORT (default 4002).
 * Usage: node scripts/test-gym-classes-api.js
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

  const gym = await prisma.gym.findFirst({ where: { ownerId: gymOwner.id } });
  assert(gym, 'No gym for owner');

  let trainer = await prisma.gymStaff.findFirst({
    where: { gymId: gym.id, role: 'trainer', isActive: true },
  });
  if (!trainer) {
    trainer = await prisma.gymStaff.create({
      data: { gymId: gym.id, fullName: 'Classes Test Trainer', role: 'trainer', baseSalary: 5000 },
    });
  }

  const ownerToken = jwt.sign({ sub: gymOwner.id, role: 'gym' }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sessionDate = tomorrow.toISOString().slice(0, 10);

  const { res: createRes, json: created } = await api(`/api/gyms/${gym.id}/classes`, ownerToken, {
    method: 'POST',
    body: JSON.stringify({
      name: `HIIT ${Date.now()}`,
      price: 250,
      staffId: trainer.id,
      sessionDate,
      startTime: '10:00',
      endTime: '11:30',
    }),
  });
  assert(createRes.status === 201, `create class failed: ${createRes.status} ${JSON.stringify(created)}`);
  console.log('✓ POST /classes', created.id, created.name);

  const { res: listRes, json: list } = await api(`/api/gyms/${gym.id}/classes`, ownerToken);
  assert(listRes.ok, `list classes failed: ${listRes.status}`);
  assert(Array.isArray(list) && list.some((row) => row.id === created.id), 'created class not in list');
  console.log('✓ GET /classes', list.length, 'classes');

  const { res: delRes } = await api(`/api/gyms/${gym.id}/classes/${created.id}`, ownerToken, {
    method: 'DELETE',
  });
  assert(delRes.ok, `delete class failed: ${delRes.status}`);
  console.log('✓ DELETE /classes', created.id);
}

main()
  .catch((err) => {
    console.error('✗', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
