/**
 * Smoke test GET /api/gyms/:id/reviews/summary
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;
const gymName = process.argv[2] || 'Wizz';

async function main() {
  const gym = await prisma.gym.findFirst({
    where: { name: gymName, isActive: true },
    select: { id: true, name: true },
  });
  if (!gym) throw new Error(`Gym not found: ${gymName}`);

  const athlete = await prisma.user.findFirst({
    where: { role: 'athlete' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true },
  });
  if (!athlete) throw new Error('No athlete user found');

  const token = jwt.sign({ sub: athlete.id, role: athlete.role }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  const res = await fetch(`${BASE}/api/gyms/${gym.id}/reviews/summary`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const body = await res.json();

  console.log('Gym:', gym.name);
  console.log('Status:', res.status);
  console.log('Summary:', JSON.stringify(body, null, 2));

  if (res.status !== 200) throw new Error('Expected 200');
  if (body.source !== 'openai') {
    console.warn('WARN: source is not openai — restart backend if key was added recently');
  } else {
    console.log('✓ OpenAI summary OK');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
