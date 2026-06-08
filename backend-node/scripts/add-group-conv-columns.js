require('dotenv').config();
const { prisma } = require('../src/db');

async function run() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE community_conversations
      ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS name VARCHAR(100)
  `);
  console.log('Columns added: is_group, name');
  await prisma.$disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
