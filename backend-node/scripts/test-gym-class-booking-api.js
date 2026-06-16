/**
 * Gym class booking API — run while backend is on PORT (default 4002).
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

async function main() {
  const gymOwner = await prisma.user.findFirst({
    where: { role: 'gym' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!gymOwner) throw new Error('No gym owner');

  const gym = await prisma.gym.findFirst({ where: { ownerId: gymOwner.id } });
  if (!gym) throw new Error('No gym');

  let gymClass = await prisma.gymClass.findFirst({ where: { gymId: gym.id, isActive: true } });
  if (!gymClass) {
    let trainer = await prisma.gymStaff.findFirst({
      where: { gymId: gym.id, role: 'trainer', isActive: true },
    });
    if (!trainer) {
      trainer = await prisma.gymStaff.create({
        data: { gymId: gym.id, fullName: 'Booking Trainer', role: 'trainer', baseSalary: 4000 },
      });
    }
    const sessionDate = new Date();
    sessionDate.setDate(sessionDate.getDate() + 2);
    gymClass = await prisma.gymClass.create({
      data: {
        gymId: gym.id,
        name: 'Booking Test Class',
        price: 150,
        staffId: trainer.id,
        sessionDate,
        dayOfWeek: sessionDate.getDay(),
        startTime: '10:00',
        endTime: '11:00',
      },
    });
  }

  const token = jwt.sign({ sub: gymOwner.id, role: 'gym' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const athlete = await prisma.user.findFirst({
    where: { role: 'athlete' },
    select: { email: true, id: true },
  });
  if (!athlete) throw new Error('No athlete user for booking test');

  const { res, json } = await api(`/api/gyms/${gym.id}/classes/${gymClass.id}/bookings`, token, {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Sara',
      lastName: 'Ali',
      email: athlete.email,
      paymentMethod: 'cash',
    }),
  });

  if (!res.ok) throw new Error(`booking failed ${res.status} ${JSON.stringify(json)}`);
  console.log('✓ POST booking', json.booking.id, json.accountCreated);

  await prisma.gymClassBooking.delete({ where: { id: json.booking.id } });
}

main()
  .catch((e) => {
    console.error('✗', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
