/**
 * Promote an existing user to platform admin.
 * Usage: node scripts/promote-admin.js user@example.com
 */
const { PrismaClient } = require('@prisma/client');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/promote-admin.js <email>');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }
  if (user.role === 'admin') {
    console.log(`${email} is already admin`);
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'admin' },
  });
  console.log(`Promoted ${email} to admin. Sign out and sign in again to refresh JWT.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
