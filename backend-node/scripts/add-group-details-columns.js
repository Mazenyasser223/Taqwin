require('dotenv').config();
const { prisma } = require('../src/db');

async function run() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE community_conversations
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS bio TEXT,
      ADD COLUMN IF NOT EXISTS can_add_members VARCHAR(10) NOT NULL DEFAULT 'admins',
      ADD COLUMN IF NOT EXISTS can_send_messages VARCHAR(10) NOT NULL DEFAULT 'all'
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE community_conversation_participants
      ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'member'
  `);
  console.log('Done: group detail columns added.');
  await prisma.$disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
