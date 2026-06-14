/**
 * Gym equipment inventory API — run while backend is on PORT (default 4002).
 * Usage: node scripts/test-gym-equipment-api.js
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
      data: { ownerId: gymOwner.id, name: 'Equipment Test Gym', location: 'Cairo', maxCapacity: 50 },
    });
  }

  const ownerToken = jwt.sign({ sub: gymOwner.id, role: 'gym' }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  const name = `Test Equipment ${Date.now()}`;
  const { res: createRes, json: created } = await api(`/api/gyms/${gym.id}/equipment`, ownerToken, {
    method: 'POST',
    body: JSON.stringify({
      name,
      nameAr: 'معدة تجريبية',
      maintenanceIntervalDays: 45,
      nextMaintenanceAt: new Date(Date.now() + 45 * 86400000).toISOString(),
    }),
  });
  assert(createRes.status === 201, `create equipment failed: ${createRes.status} ${JSON.stringify(created)}`);
  console.log('✓ POST /equipment', created.id);

  const { res: listRes, json: items } = await api(`/api/gyms/${gym.id}/equipment`, ownerToken);
  assert(listRes.ok, `list equipment failed: ${listRes.status}`);
  assert(Array.isArray(items) && items.some((row) => row.id === created.id), 'created item not in list');
  console.log('✓ GET /equipment', items.length, 'items');

  const { res: markMaintRes, json: markedMaint } = await api(
    `/api/gyms/${gym.id}/equipment/${created.id}/mark-maintenance`,
    ownerToken,
    { method: 'POST', body: '{}' },
  );
  assert(markMaintRes.ok, `mark maintenance failed: ${markMaintRes.status}`);
  assert(markedMaint.needsMaintenance === true, 'needsMaintenance expected true');
  console.log('✓ POST mark-maintenance');

  const { res: completeMaintRes, json: completedMaint } = await api(
    `/api/gyms/${gym.id}/equipment/${created.id}/complete-maintenance`,
    ownerToken,
    { method: 'POST', body: '{}' },
  );
  assert(completeMaintRes.ok, `complete maintenance failed: ${completeMaintRes.status}`);
  assert(completedMaint.needsMaintenance === false, 'needsMaintenance expected false');
  assert(completedMaint.lastMaintenanceAt, 'lastMaintenanceAt missing');
  assert(completedMaint.nextMaintenanceAt, 'nextMaintenanceAt missing');
  console.log('✓ POST complete-maintenance');

  const { res: markCleanRes, json: markedClean } = await api(
    `/api/gyms/${gym.id}/equipment/${created.id}/mark-cleaning`,
    ownerToken,
    { method: 'POST', body: '{}' },
  );
  assert(markCleanRes.ok, `mark cleaning failed: ${markCleanRes.status}`);
  assert(markedClean.needsCleaning === true, 'needsCleaning expected true');
  console.log('✓ POST mark-cleaning');

  const { res: completeCleanRes, json: completedClean } = await api(
    `/api/gyms/${gym.id}/equipment/${created.id}/complete-cleaning`,
    ownerToken,
    { method: 'POST', body: '{}' },
  );
  assert(completeCleanRes.ok, `complete cleaning failed: ${completeCleanRes.status}`);
  assert(completedClean.needsCleaning === false, 'needsCleaning expected false');
  assert(completedClean.lastCleanedAt, 'lastCleanedAt missing');
  console.log('✓ POST complete-cleaning');

  const { res: patchRes, json: patched } = await api(
    `/api/gyms/${gym.id}/equipment/${created.id}`,
    ownerToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ name: `${name} Updated` }),
    },
  );
  assert(patchRes.ok, `patch equipment failed: ${patchRes.status}`);
  assert(patched.name === `${name} Updated`, 'name not updated');
  console.log('✓ PATCH /equipment/:id');

  const { res: deleteRes } = await api(`/api/gyms/${gym.id}/equipment/${created.id}`, ownerToken, {
    method: 'DELETE',
  });
  assert(deleteRes.ok, `delete equipment failed: ${deleteRes.status}`);
  console.log('✓ DELETE /equipment/:id');

  console.log('\nAll gym equipment API checks passed.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
