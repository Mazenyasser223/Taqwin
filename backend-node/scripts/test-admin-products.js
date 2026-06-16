const { prisma } = require('../src/db');
const { normalizeProduct } = require('../src/lib/shopProduct');

async function main() {
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { name: 'asc' },
  });
  console.log('count', products.length);
  let fails = 0;
  for (const p of products) {
    try {
      normalizeProduct(p);
    } catch (e) {
      fails++;
      console.error('normalize fail', p.id, p.name, e.message);
    }
  }
  console.log('fails', fails);
}

main()
  .catch((e) => {
    console.error('ERROR', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
