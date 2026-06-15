const { prisma } = require('../src/db');

async function main() {
  const rows = await prisma.$queryRaw`
    SELECT status, COUNT(*)::int AS count
    FROM orders
    GROUP BY status
    ORDER BY count DESC
  `;
  console.log('statuses', rows);

  const col = await prisma.$queryRaw`
    SELECT column_name, udt_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'status'
  `;
  console.log('column', col);

  const enums = await prisma.$queryRaw`
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'OrderStatus'
    ORDER BY e.enumsortorder
  `;
  console.log('enum values', enums);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
