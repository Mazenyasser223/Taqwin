const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;

async function main() {
  const users = await prisma.user.findMany({
    where: { role: 'gym' },
    select: { id: true, email: true },
    take: 5,
  });
  console.log('gym users:', users);

  for (const u of users) {
    const gym = await prisma.gym.findFirst({ where: { ownerId: u.id } });
    console.log(`- ${u.email}: gym=${gym?.id ?? 'NONE'} ${gym?.name ?? ''}`);
  }

  const testUser = await prisma.user.findFirst({
    where: { email: { contains: 'test', mode: 'insensitive' }, role: 'gym' },
    select: { id: true, email: true },
  });
  const target = testUser ?? users[0];
  if (!target) throw new Error('No gym user');

  const token = jwt.sign({ sub: target.id, role: 'gym' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const res = await fetch(`${BASE}/api/dashboard/gym`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  console.log('\nGET /api/dashboard/gym as', target.email);
  console.log('status', res.status);
  console.log(text.slice(0, 3000));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
