require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('../generated/prisma');

const email = (process.argv[2] || 'agamy2815@gmail.com').trim().toLowerCase();
const password = process.argv[3] || 'Taqwin#2025';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      passwordHash: true,
      googleId: true,
      twoFactorEnabled: true,
    },
  });

  if (!user) {
    console.log('USER_NOT_FOUND:', email);
    return;
  }

  console.log('USER:', {
    email: user.email,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
    hasPassword: Boolean(user.passwordHash),
    googleId: user.googleId,
    twoFactorEnabled: user.twoFactorEnabled,
  });

  if (user.passwordHash) {
    const ok = await bcrypt.compare(password, user.passwordHash);
    console.log('PASSWORD_MATCH_Taqwin2025:', ok);
  }

  const base = `http://127.0.0.1:${process.env.PORT || 4002}`;
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, rememberMe: true }),
  });
  const body = await res.json();
  console.log('API_LOGIN:', res.status, body.error || (body.token ? 'OK' : body));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
