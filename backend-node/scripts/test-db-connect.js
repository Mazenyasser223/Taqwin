require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');

async function test(label, url) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    await p.$connect();
    const n = await p.user.count();
    console.log(`${label}: OK (users=${n})`);
  } catch (e) {
    console.error(`${label}: FAIL — ${e.message.split('\n')[0]}`);
  } finally {
    await p.$disconnect();
  }
}

(async () => {
  await test('DATABASE_URL', process.env.DATABASE_URL);
  await test('DIRECT_URL', process.env.DIRECT_URL);
})();
