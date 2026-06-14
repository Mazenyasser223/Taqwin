require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const gyms = await prisma.user.findMany({
    where: { role: 'gym' },
    select: { id: true, email: true, passwordHash: true, emailVerifiedAt: true },
    take: 10,
  });
  console.log('gym users:', gyms.length);
  for (const u of gyms) {
    const ok = u.passwordHash ? await bcrypt.compare('Taqwin#2025', u.passwordHash) : false;
    console.log(`- ${u.email} verified=${!!u.emailVerifiedAt} pwMatch=${ok}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
