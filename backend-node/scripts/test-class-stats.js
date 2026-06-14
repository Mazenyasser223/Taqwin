/**
 * Quick check: dashboard classSessionStats includes all classes.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;

async function main() {
  const owner = await prisma.user.findFirst({ where: { role: 'gym' }, select: { id: true, role: true } });
  if (!owner) throw new Error('No gym owner');

  const token = jwt.sign({ sub: owner.id, role: owner.role }, process.env.JWT_SECRET);
  const res = await fetch(`${BASE}/api/dashboard/gym`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`dashboard failed ${res.status}`);

  const stats = data.classSessionStats;
  if (!stats || !Array.isArray(stats.sessions)) throw new Error('classSessionStats.sessions missing');

  console.log('✓ classSessionStats', {
    totalBooked: stats.totalBooked,
    totalAttended: stats.totalAttended,
    totalRevenue: stats.totalRevenue,
    classCount: stats.sessions.length,
    sample: stats.sessions.slice(0, 3).map((s) => ({
      name: s.name,
      booked: s.booked,
      attended: s.attended,
      revenue: s.revenue,
    })),
  });
}

main()
  .catch((err) => {
    console.error('✗', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
