require('dotenv').config();
const { prisma } = require('../src/db');

prisma.webtebFood
  .count()
  .then((c) => console.log('webteb_foods:', c))
  .finally(() => prisma.$disconnect());
