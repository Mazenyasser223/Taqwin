require('dotenv').config();
const { prisma } = require('../src/db');

(async () => {
  try {
    const grouped = await prisma.exercise.groupBy({
      by: ['category'],
      where: { isPublic: true },
      _count: { category: true },
      orderBy: { _count: { category: 'desc' } },
    });
    const rows = await prisma.exercise.findMany({
      where: { isPublic: true },
      orderBy: { name: 'asc' },
      take: 3,
    });
    console.log('categories', grouped.length, 'rows', rows.length);
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
