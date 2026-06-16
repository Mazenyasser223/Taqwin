const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient();

async function main() {
  const tables = await p.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;

  const mig = await p.$queryRaw`
    SELECT migration_name, finished_at
    FROM _prisma_migrations
    ORDER BY finished_at DESC
    LIMIT 8
  `;

  const roles = await p.$queryRaw`
    SELECT unnest(enum_range(NULL::"Role"))::text AS role
  `;

  const watch = ['profiles', 'athlete_profiles', 'gym_profiles', 'trainer_bookings', 'users'];
  const counts = {};
  for (const t of watch) {
    try {
      const r = await p.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`);
      counts[t] = r[0].c;
    } catch {
      counts[t] = 'missing';
    }
  }

  const profileMigs = await p.$queryRaw`
    SELECT migration_name, finished_at, logs
    FROM _prisma_migrations
    WHERE migration_name LIKE '%profile%'
       OR migration_name LIKE '%split%'
       OR migration_name LIKE '%repair%'
    ORDER BY finished_at DESC NULLS LAST
  `;

  console.log(
    JSON.stringify(
      { tables: tables.map((x) => x.table_name), recentMigrations: mig, profileMigrations: profileMigs, roles, counts },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
