require('dotenv').config({ override: true });
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../src/db');
const { enrichAuthUser } = require('../src/lib/shopAdminAccess');

const TEST_EMAIL = 'shop-e2e@taqwin.test';
const TEST_PASSWORD = 'ShopE2e123!';

(async () => {
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);
  let user = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    create: { email: TEST_EMAIL, passwordHash: hash, role: 'athlete', emailVerifiedAt: new Date() },
    update: { passwordHash: hash },
  });
  user = await enrichAuthUser(user);
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );
  console.log(JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, token, canManageShop: user.canManageShop }));
  await prisma.$disconnect();
})();
