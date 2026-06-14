require('dotenv').config();
const { prisma } = require('../src/db');

async function check() {
  const orphans = await prisma.$queryRaw`
    SELECT g.id, g.name, g.owner_id
    FROM community_groups g
    LEFT JOIN users u ON u.id = g.owner_id
    WHERE u.id IS NULL
  `;
  console.log('Orphan groups found:', orphans.length);
  orphans.forEach(o => console.log(' -', o.id, '|', o.name, '| owner_id:', o.owner_id));

  if (orphans.length > 0) {
    console.log('\nDeleting orphan groups...');
    for (const o of orphans) {
      await prisma.$executeRawUnsafe(`DELETE FROM community_groups WHERE id = '${o.id}'`);
      console.log('Deleted:', o.id, o.name);
    }
    console.log('Done.');
  }

  await prisma.$disconnect();
  process.exit(0);
}

check().catch(e => { console.error(e.message); process.exit(1); });
