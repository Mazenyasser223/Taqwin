require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename LIMIT 30`;
  console.log('tables count sample:', tables.length);
  console.log(tables.map((t) => t.tablename).join('\n'));
  try {
    const users = await prisma.user.count();
    console.log('users count', users);
  } catch (e) {
    console.log('user query error', e.message);
  }
  try {
    const profiles = await prisma.profile.count();
    console.log('profiles count', profiles);
  } catch (e) {
    console.log('profile query error', e.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
