/**
 * Reset password for a user (dev helper).
 * Usage: node scripts/reset-user-password.js <email> <newPassword>
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];
  if (!email || !password) {
    console.log('Usage: node scripts/reset-user-password.js <email> <newPassword>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found:', email);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
  });

  const base = `http://127.0.0.1:${process.env.PORT || 4002}`;
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, rememberMe: true }),
  });
  const loginBody = await loginRes.json();

  console.log('Email:', email);
  console.log('Password updated.');
  console.log('Login test:', loginRes.status, loginBody.token ? 'OK' : loginBody.error);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
