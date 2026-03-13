const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function fixRoleData() {
  try {
    console.log('Updating existing user roles...');
    
    // Update any 'user' roles to 'athlete'
    await prisma.$executeRawUnsafe(`UPDATE users SET role = 'athlete' WHERE role = 'user'`);
    console.log('✅ Updated user → athlete');
    
    // Update any 'gym_owner' roles to 'gym'
    await prisma.$executeRawUnsafe(`UPDATE users SET role = 'gym' WHERE role = 'gym_owner'`);
    console.log('✅ Updated gym_owner → gym');
    
    console.log('✅ Role data updated successfully');
  } catch (error) {
    console.error('Error updating roles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixRoleData();
