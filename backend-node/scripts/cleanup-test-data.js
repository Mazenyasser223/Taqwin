/**
 * Remove dev / smoke-test artifacts (not seed demo accounts).
 * Usage: node scripts/cleanup-test-data.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const smokeUsers = await prisma.user.findMany({
    where: { email: { startsWith: 'smoke.test.' } },
    select: { id: true, email: true },
  });
  for (const u of smokeUsers) {
    await prisma.user.delete({ where: { id: u.id } });
    console.log('Deleted smoke user:', u.email);
  }
  if (smokeUsers.length === 0) console.log('No smoke.test.* users found.');

  const testPlans = await prisma.gymSubscriptionPlan.findMany({
    where: { name: { startsWith: 'Test Plan ' } },
    include: { _count: { select: { memberships: true } } },
  });
  for (const plan of testPlans) {
    if (plan._count.memberships > 0) {
      await prisma.gymSubscriptionPlan.update({
        where: { id: plan.id },
        data: { isActive: false },
      });
      console.log('Deactivated test plan (has members):', plan.name);
    } else {
      await prisma.gymSubscriptionPlan.delete({ where: { id: plan.id } });
      console.log('Deleted test plan:', plan.name);
    }
  }
  if (testPlans.length === 0) console.log('No "Test Plan *" plans found.');

  const testStaff = await prisma.gymStaff.findMany({
    where: {
      OR: [
        { email: { endsWith: '@test.local' } },
        { fullName: { startsWith: 'Test Staff ' } },
        { fullName: 'Diag Staff' },
      ],
    },
    select: { id: true, fullName: true, email: true },
  });
  for (const member of testStaff) {
    await prisma.gymStaff.update({
      where: { id: member.id },
      data: { isActive: false },
    });
    console.log('Deactivated test staff:', member.fullName, member.email ?? '');
  }
  if (testStaff.length === 0) console.log('No test staff found.');

  console.log('Cleanup done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
