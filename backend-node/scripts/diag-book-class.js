require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;

async function main() {
  const owner = await prisma.user.findFirst({ where: { role: 'gym' }, select: { id: true, role: true } });
  const gym = await prisma.gym.findFirst({ where: { ownerId: owner.id } });
  const token = jwt.sign({ sub: owner.id, role: owner.role }, process.env.JWT_SECRET);

  const classes = await prisma.gymClass.findMany({
    where: { gymId: gym.id, name: { contains: 'Booking Test' } },
    select: { id: true, name: true, isActive: true, sessionDate: true, startTime: true, endTime: true },
  });
  console.log('DB classes:', classes);

  const listRes = await fetch(`${BASE}/api/gyms/${gym.id}/classes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const list = await listRes.json();
  console.log('GET /classes', listRes.status, list.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive })));

  for (const cls of classes) {
    const bookRes = await fetch(`${BASE}/api/gyms/${gym.id}/classes/${cls.id}/bookings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Test',
        lastName: 'User',
        email: `diag-${Date.now()}@test.local`,
        paymentMethod: 'cash',
      }),
    });
    const bookBody = await bookRes.text();
    console.log(`POST book ${cls.id} active=${cls.isActive}`, bookRes.status, bookBody.slice(0, 120));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
