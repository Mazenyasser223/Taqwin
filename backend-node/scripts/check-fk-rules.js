const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRaw`
    SELECT
      tc.table_name,
      tc.constraint_name,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.constraint_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND rc.unique_constraint_schema = 'public'
      AND EXISTS (
        SELECT 1
        FROM information_schema.key_column_usage kcu
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE kcu.constraint_name = tc.constraint_name
          AND ccu.table_name = 'users'
      )
    ORDER BY tc.table_name, tc.constraint_name
  `;
  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
