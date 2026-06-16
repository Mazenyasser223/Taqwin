/**
 * Remove all @taqwin.app test users, their gyms, and orphan API-test gym rows.
 * Keeps real accounts (e.g. t2t0test@gmail.com).
 * Usage: node scripts/cleanup-gym-demo-data.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/** Gyms created by API test scripts (delete by name if orphaned) */
const TEST_GYM_NAMES = [
  'Plans Test Gym',
  'Staff Test Gym',
  'Equipment Test Gym',
  'Test Gym Reception',
];

async function deleteUsersByEmailSuffix(suffix) {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: suffix } },
    select: { id: true, email: true, ownedGyms: { select: { id: true, name: true } } },
    orderBy: { email: 'asc' },
  });
  for (const user of users) {
    for (const gym of user.ownedGyms) {
      console.log('  gym cascade:', gym.name, gym.id);
    }
    await prisma.user.delete({ where: { id: user.id } });
    console.log('Deleted user:', user.email);
  }
  if (users.length === 0) {
    console.log(`No users with email ending ${suffix}`);
  }
  return users.length;
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
  console.log('=== Cleanup @taqwin.app test users ===\n');
  const deleted = await deleteUsersByEmailSuffix('@taqwin.app');
  await deleteOrphanTestGyms();

  const remaining = await prisma.gym.findMany({
    select: { name: true, owner: { select: { email: true } } },
    orderBy: { name: 'asc' },
  });
  console.log(`\nRemoved ${deleted} @taqwin.app user(s).`);
  console.log('Remaining gyms:', remaining.length);
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
