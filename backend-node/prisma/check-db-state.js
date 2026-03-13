const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    // Check current enum values
    const enumValues = await prisma.$queryRaw`
      SELECT e.enumlabel as value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid  
      WHERE t.typname = 'Role'
      ORDER BY e.enumsortorder;
    `;
    console.log('Current Role enum values:', enumValues);
    
    // Check what roles exist in the users table
    const users = await prisma.$queryRaw`SELECT DISTINCT role FROM users`;
    console.log('Current user roles in database:', users);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
