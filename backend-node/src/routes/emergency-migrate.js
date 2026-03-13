// Emergency migration endpoint - DELETE AFTER USE
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

// Create a fresh Prisma client that bypasses validation for this migration
const prisma = new PrismaClient();

router.post('/emergency-migrate-role-enum', async (req, res) => {
  try {
    console.log('=== EMERGENCY ROLE ENUM MIGRATION ===');
    
    // Step 1: Create new enum
    console.log('Step 1: Creating new enum...');
    await prisma.$executeRawUnsafe(`CREATE TYPE "Role_new" AS ENUM ('athlete', 'trainer', 'gym')`);
    
    // Step 2: Migrate column with data transformation
    console.log('Step 2: Migrating column...');
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
    
    // Step 3: Replace old enum
    console.log('Step 3: Replacing old enum...');
    await prisma.$executeRawUnsafe(`DROP TYPE "Role"`);
    await prisma.$executeRawUnsafe(`ALTER TYPE "Role_new" RENAME TO "Role"`);
    
    console.log('✅ Migration complete!');
    res.json({ success: true, message: 'Role enum migrated successfully' });
    
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
