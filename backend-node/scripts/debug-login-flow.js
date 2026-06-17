require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/db');
const { attachProfile, PROFILE_INCLUDE } = require('../src/lib/profile');

const email = (process.argv[2] || 'demo@taqwin.app').trim().toLowerCase();
const password = process.argv[3] || 'Taqwin#2025';

async function main() {
  const user = await prisma.user.findUnique({ where: { email } });
  console.log('step1 user', user ? user.email : null);

  if (!user?.passwordHash) {
    console.log('no password');
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  console.log('step2 password valid', valid);
  if (!valid) return;

  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' },
  );
  console.log('step3 token ok', Boolean(token));

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      ...PROFILE_INCLUDE,
    },
  });
  console.log('step4 fullUser', fullUser?.email);

  const withProfile = attachProfile(fullUser);
  console.log('step5 profile', withProfile?.profile);
  console.log('LOGIN_OK');
}

main()
  .catch((e) => {
    console.error('LOGIN_FAIL', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
