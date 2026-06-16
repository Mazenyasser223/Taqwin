/**
 * Dev helper — ensure gym owner can log in with Taqwin#2025
 * Usage: node scripts/ensure-dev-gym-login.js [email]
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DEV_PASSWORD = 'Taqwin#2025';

async function main() {
  const emailArg = process.argv[2];
  let user = emailArg
    ? await prisma.user.findUnique({ where: { email: emailArg.trim().toLowerCase() } })
    : await prisma.user.findFirst({ where: { role: 'gym' }, orderBy: { createdAt: 'asc' } });

  if (!user) {
    console.log('No gym user found — run: npm run db:seed');
    return;
  }

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  user = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
  });

  let gym = await prisma.gym.findFirst({ where: { ownerId: user.id } });
  if (!gym) {
    gym = await prisma.gym.create({
      data: {
        ownerId: user.id,
        name: 'Iron House Gym',
        location: 'Cairo, Maadi',
        maxCapacity: 250,
        phone: '+20 100 111 2222',
      },
    });
    console.log('Created gym:', gym.id);
  }

  const loginRes = await fetch(`http://127.0.0.1:${process.env.PORT || 4002}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: DEV_PASSWORD, rememberMe: true }),
  });
  const loginBody = await loginRes.json();

  console.log('Gym owner:', user.email);
  console.log('Password:', DEV_PASSWORD);
  console.log('Gym id:', gym.id);
  console.log('Login test:', loginRes.status, loginBody.token ? 'OK' : loginBody.error);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
