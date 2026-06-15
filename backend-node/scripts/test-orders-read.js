const { prisma } = require('../src/db');

async function main() {
  const orders = await prisma.order.findMany({
    take: 5,
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  console.log(
    'ok',
    orders.length,
    orders.map((o) => ({ status: o.status, email: o.user?.email }))
  );
}

main()
  .catch((e) => {
    console.error('FAIL', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
