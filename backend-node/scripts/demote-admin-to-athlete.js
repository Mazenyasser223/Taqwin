/**
 * Demote a platform admin back to athlete (e.g. dev account promoted by mistake).
 * Usage: node scripts/demote-admin-to-athlete.js user@example.com
 */
const { PrismaClient } = require('@prisma/client');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/demote-admin-to-athlete.js <email>');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }
  if (user.role === 'athlete') {
    console.log(`${email} is already athlete`);
    return;
  }
  if (user.role === 'gym') {
    console.error(`${email} is a gym account; use the gym onboarding flow instead.`);
    process.exit(1);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'athlete' },
  });
  console.log(`Demoted ${email} to athlete. Sign out and sign in again to refresh JWT.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
