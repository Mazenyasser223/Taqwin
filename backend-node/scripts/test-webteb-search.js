require('dotenv').config();
const { searchWebteb } = require('../src/lib/nutritionWebtebSearchCore');
const { prisma } = require('../src/db');

searchWebteb({ categoryId: 'vegetables', page: 1, pageSize: 25 })
  .then((r) => {
    console.log('total', r.totalHits, 'page', r.foods.length);
    console.log(r.foods[0]);
  })
  .finally(() => prisma.$disconnect());
