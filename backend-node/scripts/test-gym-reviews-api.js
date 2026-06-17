/**
 * Smoke test gym review moderation endpoint.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;

async function main() {
  const gym = await prisma.gym.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });
  if (!gym) throw new Error('No active gym found');

  const athlete = await prisma.user.findFirst({
    where: { role: 'athlete' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!athlete) throw new Error('No athlete user found');

  const token = jwt.sign({ sub: athlete.id, role: 'athlete' }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept-Language': 'ar',
  };

  const cleanRes = await fetch(`${BASE}/api/gyms/${gym.id}/reviews`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ rating: 5, body: 'صالة ممتازة ونظيفة' }),
  });
  const cleanBody = await cleanRes.json();
  if (cleanRes.status !== 201) {
    throw new Error(`Clean review failed: ${cleanRes.status} ${JSON.stringify(cleanBody)}`);
  }
  console.log('✓ Clean review accepted (201)');

  const badRes = await fetch(`${BASE}/api/gyms/${gym.id}/reviews`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ rating: 1, body: 'بزاز' }),
  });
  const badBody = await badRes.json();
  if (badRes.status !== 422 || badBody.code !== 'content_moderated') {
    throw new Error(`Profanity review should be 422: ${badRes.status} ${JSON.stringify(badBody)}`);
  }
  console.log('✓ Profanity blocked (422 content_moderated)');

  for (const word of ['طياز', 'كوس', 'زوبري']) {
    const res = await fetch(`${BASE}/api/gyms/${gym.id}/reviews`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rating: 1, body: word }),
    });
    const body = await res.json();
    if (res.status !== 422) {
      throw new Error(`Expected ${word} blocked, got ${res.status}`);
    }
    console.log(`✓ "${word}" blocked`);
  }

  console.log('\nGym review moderation OK.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
