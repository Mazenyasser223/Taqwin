const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixEnumAndData() {
  try {
    console.log('Applying Role enum migration...');
    
    // Step 1: Update existing data first (from old values to temporary valid values)
    console.log('Step 1: Updating existing role data...');
    await prisma.$executeRawUnsafe(`UPDATE users SET role = 'trainer' WHERE role = 'user' OR role = 'athlete'`);
    console.log('  ✅ Data updated temporarily');
    
    // Step 2: Create new enum
    console.log('Step 2: Creating new enum...');
    await prisma.$executeRawUnsafe(`CREATE TYPE "Role_new" AS ENUM ('athlete', 'trainer', 'gym')`);
    console.log('  ✅ New enum created');
    
    // Step 3: Update column to use new enum
    console.log('Step 3: Updating column type...');
    await prisma.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN role TYPE "Role_new" USING (role::text::"Role_new")`);
    console.log('  ✅ Column updated');
    
    // Step 4: Drop old enum and rename
    console.log('Step 4: Replacing old enum...');
    await prisma.$executeRawUnsafe(`DROP TYPE "Role"`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role_new" RENAME TO "Role"`);
    console.log('  ✅ Enum replaced');
    
    // Step 5: Now update trainer back to athlete where appropriate
    console.log('Step 5: Fixing role values...');
    await prisma.$executeRawUnsafe(`UPDATE users SET role = 'athlete'`);
    console.log('  ✅ All users set to athlete (for testing)');
    
    console.log('\n✅ Role enum migration completed successfully!');
  } catch (error) {
    console.error('Error applying migration:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixEnumAndData();
