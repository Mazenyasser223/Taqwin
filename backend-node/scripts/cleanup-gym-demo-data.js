/**
 * Remove seed / map-test gym owners, their gyms, and demo athlete accounts.
 * Keeps real gym accounts (e.g. t2t0test@gmail.com / Wizz).
 * Usage: node scripts/cleanup-gym-demo-data.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/** Seed + map-test accounts — not production gym owners */
const DEMO_GYM_OWNER_EMAILS = [
  'iron.house@taqwin.app',
  'pulse.fit@taqwin.app',
  'flow.studio@taqwin.app',
];

const DEMO_ATHLETE_EMAILS = ['demo@taqwin.app'];

/** Gyms created by API test scripts (delete by name if orphaned) */
const TEST_GYM_NAMES = [
  'Plans Test Gym',
  'Staff Test Gym',
  'Equipment Test Gym',
  'Test Gym Reception',
];

async function deleteUserByEmail(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, ownedGyms: { select: { id: true, name: true } } },
  });
  if (!user) {
    console.log('Skip (not found):', email);
    return;
  }
  for (const gym of user.ownedGyms) {
    console.log('  gym to cascade:', gym.name, gym.id);
  }
  await prisma.user.delete({ where: { id: user.id } });
  console.log('Deleted user:', email);
}

async function deleteOrphanTestGyms() {
  const gyms = await prisma.gym.findMany({
    where: { name: { in: TEST_GYM_NAMES } },
    select: { id: true, name: true, owner: { select: { email: true } } },
  });
  for (const gym of gyms) {
    await prisma.gym.delete({ where: { id: gym.id } });
    console.log('Deleted test gym:', gym.name, `(owner: ${gym.owner.email})`);
  }
  if (gyms.length === 0) console.log('No orphan test gyms by name.');
}

async function main() {
  console.log('=== Cleanup gym demo / test data ===\n');

  for (const email of DEMO_GYM_OWNER_EMAILS) {
    await deleteUserByEmail(email);
  }
  for (const email of DEMO_ATHLETE_EMAILS) {
    await deleteUserByEmail(email);
  }

  await deleteOrphanTestGyms();

  const remaining = await prisma.gym.findMany({
    select: { name: true, owner: { select: { email: true } } },
    orderBy: { name: 'asc' },
  });
  console.log('\nRemaining gyms:', remaining.length);
  for (const g of remaining) {
    console.log(`  - ${g.name} (${g.owner.email})`);
  }
  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
