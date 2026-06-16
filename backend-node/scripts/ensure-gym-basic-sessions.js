/**
 * Apply basic-sessions tables + seed spa/jacuzzi/sauna for all gyms.
 * Usage: node scripts/ensure-gym-basic-sessions.js
 */
require('dotenv').config();
const { prisma } = require('../src/db');
const { seedBasicSessions, ensureBasicSessionsForGym } = require('../src/lib/gymBasicSessions');

const MIGRATION_SQL = `
CREATE TYPE "GymBasicSessionType" AS ENUM ('spa', 'jacuzzi', 'sauna');
`;

async function ensureTables() {
  const exists = await prisma.$queryRaw`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gym_basic_sessions'
    LIMIT 1
  `;
  if (Array.isArray(exists) && exists.length > 0) return;

  console.log('Creating gym_basic_sessions tables…');
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "GymBasicSessionType" AS ENUM ('spa', 'jacuzzi', 'sauna');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "gym_basic_sessions" (
      "id" TEXT NOT NULL,
      "gym_id" TEXT NOT NULL,
      "type" "GymBasicSessionType" NOT NULL,
      "name" TEXT NOT NULL,
      "name_ar" TEXT,
      "price" DOUBLE PRECISION NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'EGP',
      "is_active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "gym_basic_sessions_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "gym_basic_session_bookings" (
      "id" TEXT NOT NULL,
      "gym_id" TEXT NOT NULL,
      "session_id" TEXT NOT NULL,
      "user_id" TEXT NOT NULL,
      "paid_amount" DOUBLE PRECISION NOT NULL,
      "payment_method" TEXT NOT NULL,
      "status" "GymClassBookingStatus" NOT NULL DEFAULT 'booked',
      "notes" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "gym_basic_session_bookings_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "gym_basic_sessions_gym_id_type_key"
    ON "gym_basic_sessions"("gym_id", "type");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "gym_basic_sessions_gym_id_is_active_idx"
    ON "gym_basic_sessions"("gym_id", "is_active");
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "gym_basic_sessions"
        ADD CONSTRAINT "gym_basic_sessions_gym_id_fkey"
        FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "gym_basic_session_bookings"
        ADD CONSTRAINT "gym_basic_session_bookings_gym_id_fkey"
        FOREIGN KEY ("gym_id") REFERENCES "gyms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "gym_basic_session_bookings"
        ADD CONSTRAINT "gym_basic_session_bookings_session_id_fkey"
        FOREIGN KEY ("session_id") REFERENCES "gym_basic_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "gym_basic_session_bookings"
        ADD CONSTRAINT "gym_basic_session_bookings_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  console.log('Tables ready.');
}

async function main() {
  await ensureTables();
  const gyms = await prisma.gym.findMany({ select: { id: true, name: true } });
  for (const gym of gyms) {
    await seedBasicSessions(gym.id);
    const sessions = await ensureBasicSessionsForGym(gym.id);
    console.log(`✓ ${gym.name}: ${sessions.length} basic sessions`);
  }
  console.log('\nDone.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
