/**
 * Reception API smoke test — run while backend is on PORT (default 4002).
 * Usage: node scripts/test-reception-api.js
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
  let gymOwner = await prisma.user.findFirst({
    where: { role: 'gym' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  assert(gymOwner, 'No gym owner user in DB — sign up as Gym Owner first');

  let gym = await prisma.gym.findFirst({ where: { ownerId: gymOwner.id } });
  if (!gym) {
    gym = await prisma.gym.create({
      data: {
        ownerId: gymOwner.id,
        name: 'Test Gym Reception',
        location: 'Cairo',
        maxCapacity: 100,
      },
    });
    console.log('Created test gym:', gym.id);
  }

  let athlete = await prisma.user.findFirst({
    where: { role: 'athlete', NOT: { id: gymOwner.id } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, profile: { select: { gender: true, displayName: true } } },
  });
  if (!athlete) {
    athlete = await prisma.user.findFirst({
      where: { NOT: { id: gymOwner.id } },
      select: { id: true, email: true, profile: { select: { gender: true, displayName: true } } },
    });
  }
  assert(athlete, 'No member user in DB — need at least one athlete account');

  let membership = await prisma.gymMembership.findUnique({
    where: { gymId_userId: { gymId: gym.id, userId: athlete.id } },
  });
  const freshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  membership = await prisma.gymMembership.upsert({
    where: { gymId_userId: { gymId: gym.id, userId: athlete.id } },
    create: {
      gymId: gym.id,
      userId: athlete.id,
      isActive: true,
      expiresAt: freshExpiry,
    },
    update: {
      isActive: true,
      expiresAt: freshExpiry,
    },
  });

  await prisma.profile.upsert({
    where: { userId: athlete.id },
    create: { userId: athlete.id, displayName: athlete.email.split('@')[0], gender: 'male' },
    update: { gender: athlete.profile?.gender || 'male' },
  });

  await prisma.gymCheckIn.updateMany({
    where: { gymId: gym.id, userId: athlete.id, checkedOutAt: null },
    data: { checkedOutAt: new Date() },
  });

  const ownerToken = jwt.sign({ sub: gymOwner.id, role: 'gym' }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  console.log('Testing gym:', gym.name, gym.id);
  console.log('Owner:', gymOwner.email);
  console.log('Member:', athlete.email);

  const { res: present0, json: p0 } = await api(`/api/gyms/${gym.id}/reception/present`, ownerToken);
  assert(present0.ok, `present failed: ${present0.status} ${JSON.stringify(p0)}`);
  assert(p0.counts && typeof p0.counts.total === 'number', 'present counts missing');
  console.log('✓ GET /reception/present (baseline)', p0.counts);

  const searchQ = athlete.email.split('@')[0].slice(0, 4);
  const { res: searchRes, json: search } = await api(
    `/api/gyms/${gym.id}/reception/search?q=${encodeURIComponent(searchQ)}`,
    ownerToken,
  );
  assert(searchRes.ok, `search failed: ${searchRes.status}`);
  assert(search.members?.some((m) => m.userId === athlete.id), `member not in search for q=${searchQ}`);
  console.log('✓ GET /reception/search?q=' + searchQ, search.members.length, 'results');

  const { res: detailRes, json: detail } = await api(
    `/api/gyms/${gym.id}/reception/members/${athlete.id}`,
    ownerToken,
  );
  assert(detailRes.ok, `member detail failed: ${detailRes.status}`);
  assert(detail.membershipStatus === 'active', 'expected active membership');
  assert(detail.daysRemaining !== null && detail.daysRemaining > 0, 'expected days remaining');
  assert(detail.isPresent === false, 'should not be present before check-in');
  console.log('✓ GET /reception/members/:id', { daysRemaining: detail.daysRemaining, status: detail.membershipStatus });

  const { res: inRes, json: checkedIn } = await api(`/api/gyms/${gym.id}/reception/check-in`, ownerToken, {
    method: 'POST',
    body: JSON.stringify({ userId: athlete.id }),
  });
  assert(inRes.status === 201, `check-in failed: ${inRes.status} ${JSON.stringify(checkedIn)}`);
  console.log('✓ POST /reception/check-in', checkedIn.visitId);

  const { res: dupRes } = await api(`/api/gyms/${gym.id}/reception/check-in`, ownerToken, {
    method: 'POST',
    body: JSON.stringify({ userId: athlete.id }),
  });
  assert(dupRes.status === 409, 'duplicate check-in should return 409');
  console.log('✓ POST /reception/check-in duplicate → 409');

  const { res: present1, json: p1 } = await api(`/api/gyms/${gym.id}/reception/present`, ownerToken);
  assert(present1.ok && p1.counts.total >= 1, 'present count should be >= 1');
  assert(p1.members.some((m) => m.userId === athlete.id), 'athlete should be in present list');
  console.log('✓ GET /reception/present (after check-in)', p1.counts);

  const { res: detail2, json: d2 } = await api(
    `/api/gyms/${gym.id}/reception/members/${athlete.id}`,
    ownerToken,
  );
  assert(d2.isPresent === true, 'should be present after check-in');
  console.log('✓ GET /reception/members/:id isPresent=true');

  const { res: outRes, json: checkedOut } = await api(`/api/gyms/${gym.id}/reception/check-out`, ownerToken, {
    method: 'POST',
    body: JSON.stringify({ userId: athlete.id }),
  });
  assert(outRes.ok, `check-out failed: ${outRes.status} ${JSON.stringify(checkedOut)}`);
  assert(checkedOut.checkedOutAt, 'check-out timestamp missing');
  console.log('✓ POST /reception/check-out');

  const { res: present2, json: p2 } = await api(`/api/gyms/${gym.id}/reception/present`, ownerToken);
  assert(p2.counts.total === p0.counts.total, 'present count should return to baseline after check-out');
  console.log('✓ GET /reception/present (after check-out)', p2.counts);

  const { res: listRes, json: listPayload } = await api(`/api/gyms/${gym.id}/reception/members`, ownerToken);
  assert(listRes.ok, `list members failed: ${listRes.status}`);
  assert(Array.isArray(listPayload.members) && listPayload.members.length >= 1, 'expected members list');
  console.log('✓ GET /reception/members', listPayload.members.length, 'members');

  const newEmail = `reception-test-${Date.now()}@example.com`;
  const { res: regNewRes, json: regNew } = await api(`/api/gyms/${gym.id}/reception/register`, ownerToken, {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Reception',
      lastName: 'Test',
      email: newEmail,
      phone: `+2010${String(Date.now()).slice(-8)}`,
      gender: 'male',
    }),
  });
  assert(regNewRes.status === 201, `register new member failed: ${regNewRes.status} ${JSON.stringify(regNew)}`);
  assert(regNew.accountCreated === true, 'expected accountCreated=true for new email');
  assert(regNew.member?.userId, 'register response missing member.userId');
  console.log('✓ POST /reception/register (new account)', regNew.member.userId);

  const { res: regExistingRes, json: regExisting } = await api(
    `/api/gyms/${gym.id}/reception/register`,
    ownerToken,
    {
      method: 'POST',
      body: JSON.stringify({
        firstName: 'Updated',
        lastName: 'Member',
        email: athlete.email,
      }),
    },
  );
  assert(regExistingRes.ok, `register existing member failed: ${regExistingRes.status}`);
  assert(regExisting.accountCreated === false, 'expected accountCreated=false for existing email');
  assert(regExisting.member?.userId === athlete.id, 'existing member userId mismatch');
  console.log('✓ POST /reception/register (existing account)');

  const { res: delRes, json: delPayload } = await api(
    `/api/gyms/${gym.id}/reception/members/${regNew.member.userId}`,
    ownerToken,
    { method: 'DELETE' },
  );
  assert(delRes.ok, `delete member failed: ${delRes.status} ${JSON.stringify(delPayload)}`);
  assert(delPayload.removed?.deletedMemberships === 1, 'expected membership purge');
  console.log('✓ DELETE /reception/members/:userId', regNew.member.userId, delPayload.removed);

  const { res: deletedVisitsRes } = await api(
    `/api/gyms/${gym.id}/reception/members/${regNew.member.userId}/visits`,
    ownerToken,
  );
  assert(deletedVisitsRes.status === 404, 'visits should 404 after member purge');
  console.log('✓ deleted member visit history removed');

  const deletedUser = await prisma.user.findUnique({ where: { id: regNew.member.userId } });
  assert(deletedUser, 'Taqwin user account should remain after gym purge');
  console.log('✓ Taqwin account preserved after gym purge');

  const { res: visitsRes, json: visitsPayload } = await api(
    `/api/gyms/${gym.id}/reception/members/${athlete.id}/visits`,
    ownerToken,
  );
  assert(visitsRes.ok, `member visits failed: ${visitsRes.status}`);
  assert(Array.isArray(visitsPayload.visits), 'visits array missing');
  assert(visitsPayload.stats && typeof visitsPayload.stats.totalVisits === 'number', 'visit stats missing');
  console.log('✓ GET /reception/members/:id/visits', {
    totalVisits: visitsPayload.stats.totalVisits,
    listed: visitsPayload.visits.length,
  });

  console.log('\nAll reception API checks passed.');
}

main()
  .catch((e) => {
    console.error('\nFAILED:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
