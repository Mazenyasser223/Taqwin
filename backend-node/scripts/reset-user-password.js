/**
 * Reset password for a dev account (default Taqwin#2025).
 * Usage: node scripts/reset-user-password.js agamy2815@gmail.com
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../generated/prisma');

const email = (process.argv[2] || '').trim().toLowerCase();
const password = process.argv[3] || 'Taqwin#2025';

if (!email) {
  console.error('Usage: node scripts/reset-user-password.js <email> [password]');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({
    where: { email },
    data: {
      passwordHash,
      emailVerifiedAt: new Date(),
    },
    select: { email: true, role: true },
  });

  console.log('Password reset OK');
  console.log('Email:', user.email);
  console.log('Role:', user.role);
  console.log('Password:', password);
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
