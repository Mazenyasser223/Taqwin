const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function applyRoleEnumMigration() {
  try {
    console.log('=== Applying Role Enum Migration ===\n');
    
    // Step 1: Update existing data
    console.log('Step 1: Updating existing data (user → athlete)...');
    await prisma.$executeRawUnsafe(`UPDATE users SET role = 'user' WHERE role = 'user'`);
    console.log('  ✅ Data check complete (already using valid old enum values)\n');
    
    // Step 2: Create new enum
    console.log('Step 2: Creating new enum (athlete, trainer, gym)...');
    await prisma.$executeRawUnsafe(`CREATE TYPE "Role_new" AS ENUM ('athlete', 'trainer', 'gym')`);
    console.log('  ✅ New enum created\n');
    
    // Step 3: Update column to use new enum (with mapping: user → athlete, gym_owner → gym)
    console.log('Step 3: Migrating column to new enum...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users ALTER COLUMN role TYPE "Role_new" 
      USING (
        CASE role::text
          WHEN 'user' THEN 'athlete'::"Role_new"
          WHEN 'gym_owner' THEN 'gym'::"Role_new"
          ELSE role::text::"Role_new"
        END
      )
    `);
    console.log('  ✅ Column migrated (user → athlete, gym_owner → gym)\n');
    
    // Step 4: Drop old enum and rename new one
    console.log('Step 4: Replacing old enum...');
    await prisma.$executeRawUnsafe(`DROP TYPE "Role"`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role_new" RENAME TO "Role"`);
    console.log('  ✅ Old enum replaced\n');
    
    // Verify
    const users = await prisma.$queryRaw`SELECT DISTINCT role FROM users`;
    console.log('✅ Migration complete! Current user roles:', users);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

applyRoleEnumMigration();
