/**
 * End-to-end gym map flow — 3 gym owners + 1 athlete.
 * Usage: node scripts/test-gym-map-flow.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;
const PASSWORD = 'Taqwin#2025';

const OWNERS = [
  { email: 'iron.house@taqwin.app', lat: 30.0128, lng: 31.2819 },
  { email: 'pulse.fit@taqwin.app', lat: 31.2156, lng: 29.9425 },
  { email: 'flow.studio@taqwin.app', lat: 30.0287, lng: 30.9783 },
];

async function login(email) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, rememberMe: true }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${email} login ${res.status}: ${body.error}`);
  return body.token;
}

async function jsonFetch(token, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log('=== Gym map flow (3 owners + athlete) ===\n');

  const athleteToken = await login('demo@taqwin.app');
  console.log('✓ Athlete demo@taqwin.app logged in');

  for (const owner of OWNERS) {
    const token = await login(owner.email);
    const user = await prisma.user.findUnique({ where: { email: owner.email } });
    const gym = await prisma.gym.findFirst({ where: { ownerId: user.id } });
    if (!gym) throw new Error(`Missing gym for ${owner.email}`);

    const nudgedLat = owner.lat + 0.0001;
    const patch = await jsonFetch(token, 'PATCH', `/api/gyms/${gym.id}`, {
      location: gym.location,
      latitude: nudgedLat,
      longitude: owner.lng,
      bio: gym.bio ?? 'Map test gym',
    });
    if (patch.status !== 200) throw new Error(`Owner patch failed ${owner.email}: ${JSON.stringify(patch.data)}`);
    console.log(`✓ ${owner.email} saved pin → ${patch.data.latitude}, ${patch.data.longitude}`);
  }

  const list = await jsonFetch(athleteToken, 'GET', '/api/gyms');
  if (list.status !== 200) throw new Error(`Athlete list failed: ${list.status}`);
  const mapped = list.data.filter((g) => g.latitude != null && g.longitude != null);
  if (mapped.length < 3) throw new Error(`Expected 3+ mapped gyms, got ${mapped.length}`);

  for (const owner of OWNERS) {
    const user = await prisma.user.findUnique({ where: { email: owner.email } });
    const gym = mapped.find((g) => g.ownerId === user.id);
    if (!gym) throw new Error(`Athlete cannot see gym for ${owner.email}`);
    console.log(`✓ Athlete sees ${gym.name} on map (${gym.latitude}, ${gym.longitude})`);
  }

  const sample = mapped[0];
  const detail = await jsonFetch(athleteToken, 'GET', `/api/gyms/${sample.id}`);
  if (detail.status !== 200 || !detail.data.name) throw new Error('Athlete gym detail failed');
  console.log(`✓ Athlete opened profile drawer data for ${detail.data.name}`);

  console.log('\nAll 3-owner + athlete map flow checks passed.');
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
