/**
 * Smoke test GET /api/gyms/:id/reviews
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;

async function fetchReviews(gymId, token) {
  const res = await fetch(`${BASE}/api/gyms/${gymId}/reviews`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function main() {
  const athlete = await prisma.user.findFirst({
    where: { role: 'athlete' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!athlete) throw new Error('No athlete user found');

  const token = jwt.sign({ sub: athlete.id, role: 'athlete' }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

  const gyms = await prisma.gym.findMany({
    where: { isActive: true, name: { in: ['Iron House Gym', 'Wizz', 'HEMAZ'] } },
    select: { id: true, name: true, _count: { select: { reviews: true } } },
  });

  for (const gym of gyms) {
    const { status, body } = await fetchReviews(gym.id, token);
    if (status !== 200) {
      throw new Error(`${gym.name}: GET failed ${status} ${JSON.stringify(body)}`);
    }
    if (!Array.isArray(body)) {
      throw new Error(`${gym.name}: expected array, got ${typeof body}`);
    }
    if (body.length !== gym._count.reviews) {
      throw new Error(
        `${gym.name}: API returned ${body.length} reviews, DB has ${gym._count.reviews}`,
      );
    }
    console.log(`✓ ${gym.name}: ${body.length} reviews (200)`);
  }

  console.log('\nGET gym reviews OK.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
