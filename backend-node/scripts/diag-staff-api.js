require('dotenv').config();
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE = `http://127.0.0.1:${process.env.PORT || 4002}`;

async function main() {
  const owner = await prisma.user.findFirst({ where: { role: 'gym' }, orderBy: { createdAt: 'asc' } });
  if (!owner) throw new Error('No gym owner');
  let gym = await prisma.gym.findFirst({ where: { ownerId: owner.id } });
  if (!gym) throw new Error('No gym');
  const token = jwt.sign({ sub: owner.id, role: 'gym', email: owner.email }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  for (const [method, path, body] of [
    ['GET', `/api/gyms/${gym.id}/staff`, null],
    ['POST', `/api/gyms/${gym.id}/staff`, { fullName: 'Diag Staff', email: 'diag@test.local', role: 'trainer', baseSalary: 5000 }],
  ]) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    console.log(method, path, '→', res.status, text.slice(0, 400));
  }
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
