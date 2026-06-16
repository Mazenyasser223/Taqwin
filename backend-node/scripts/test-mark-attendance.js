/**
 * Mark attendance on session day — run while backend is on PORT (default 4002).
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const {
  canMarkClassAttendance,
  gymTodayKey,
  sessionDateKey,
  isSessionDay,
} = require('../src/lib/gymClassSession');

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
  return { res, json, text };
}

async function main() {
  console.log('Cairo today:', gymTodayKey());

  const owner = await prisma.user.findFirst({ where: { role: 'gym' }, select: { id: true, role: true } });
  const gym = await prisma.gym.findFirst({ where: { ownerId: owner.id } });
  const token = jwt.sign({ sub: owner.id, role: owner.role }, process.env.JWT_SECRET);

  const classes = await prisma.gymClass.findMany({
    where: { gymId: gym.id, isActive: true },
    orderBy: { sessionDate: 'desc' },
    take: 5,
  });
  console.log(
    'Active classes:',
    classes.map((c) => ({
      name: c.name,
      sessionDate: c.sessionDate,
      key: sessionDateKey(c.sessionDate),
      isSessionDay: isSessionDay(c),
      canMark: canMarkClassAttendance(c),
    })),
  );

  const yoga = classes.find((c) => c.name.toLowerCase().includes('yoga')) ?? classes[0];
  if (!yoga) throw new Error('No active class');

  let booking = await prisma.gymClassBooking.findFirst({
    where: { classId: yoga.id, status: 'booked' },
  });
  if (!booking) {
    const athlete = await prisma.user.findFirst({ where: { role: 'athlete' } });
    booking = await prisma.gymClassBooking.create({
      data: {
        gymId: gym.id,
        classId: yoga.id,
        userId: athlete.id,
        sessionDate: yoga.sessionDate,
        paidAmount: yoga.price,
        paymentMethod: 'cash',
        status: 'booked',
      },
    });
    console.log('Created test booking', booking.id);
  }

  const { res, json, text } = await api(
    `/api/gyms/${gym.id}/classes/${yoga.id}/bookings/${booking.id}`,
    token,
    { method: 'PATCH', body: JSON.stringify({ status: 'attended' }) },
  );
  console.log('PATCH attended', res.status, text.slice(0, 200));
  if (!res.ok) throw new Error(`Mark attended failed: ${text}`);

  const dash = await api('/api/dashboard/gym', token);
  const stats = dash.json?.classSessionStats;
  const row = stats?.sessions?.find((s) => s.classId === yoga.id);
  console.log('Dashboard class row:', row);
  if (!row || row.attended < 1) throw new Error('Dashboard did not reflect attended count');

  console.log('✓ Mark attendance + dashboard OK');
}

main()
  .catch((e) => {
    console.error('✗', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
