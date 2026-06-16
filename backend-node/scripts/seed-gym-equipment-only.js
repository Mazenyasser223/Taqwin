/**
 * Idempotent gym equipment seed (no full seed guard).
 * Usage: node scripts/seed-gym-equipment-only.js
 */
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const prisma = new PrismaClient();

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

const EQUIPMENT_CATALOG = [
  {
    name: 'Treadmill',
    nameAr: 'جهاز المشي',
    imageUrl: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=400&h=300&fit=crop',
    maintenanceIntervalDays: 60,
    lastMaintenanceAt: daysAgo(45),
    nextMaintenanceAt: daysFromNow(15),
    lastCleanedAt: daysAgo(2),
  },
  {
    name: 'Bench Press',
    nameAr: 'جهاز البنش',
    imageUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=300&fit=crop',
    maintenanceIntervalDays: 90,
    lastMaintenanceAt: daysAgo(80),
    nextMaintenanceAt: daysFromNow(10),
    lastCleanedAt: daysAgo(5),
    needsMaintenance: true,
  },
  {
    name: 'Leg Press',
    nameAr: 'جهاز الرجل',
    imageUrl: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&h=300&fit=crop',
    maintenanceIntervalDays: 90,
    lastMaintenanceAt: daysAgo(30),
    nextMaintenanceAt: daysFromNow(60),
    lastCleanedAt: daysAgo(7),
    needsCleaning: true,
  },
  {
    name: 'Cable Machine',
    nameAr: 'جهاز الكابلات',
    imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=300&fit=crop',
    maintenanceIntervalDays: 120,
    lastMaintenanceAt: daysAgo(20),
    nextMaintenanceAt: daysFromNow(100),
    lastCleanedAt: daysAgo(1),
  },
  {
    name: 'Rowing Machine',
    nameAr: 'جهاز التجديف',
    imageUrl: 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=400&h=300&fit=crop',
    maintenanceIntervalDays: 60,
    lastMaintenanceAt: daysAgo(55),
    nextMaintenanceAt: daysFromNow(5),
    lastCleanedAt: daysAgo(3),
  },
  {
    name: 'Smith Machine',
    nameAr: 'جهاز Smith',
    imageUrl: 'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=400&h=300&fit=crop',
    maintenanceIntervalDays: 90,
    lastMaintenanceAt: daysAgo(10),
    nextMaintenanceAt: daysFromNow(80),
    lastCleanedAt: daysAgo(4),
  },
];

async function main() {
  const gyms = await prisma.gym.findMany({ select: { id: true, name: true } });
  if (gyms.length === 0) {
    throw new Error('No gyms in database');
  }

  let created = 0;
  for (const gym of gyms) {
    for (const eq of EQUIPMENT_CATALOG) {
      const existing = await prisma.gymEquipment.findFirst({
        where: { gymId: gym.id, name: eq.name },
      });
      if (existing) continue;
      await prisma.gymEquipment.create({
        data: {
          gymId: gym.id,
          name: eq.name,
          nameAr: eq.nameAr,
          imageUrl: eq.imageUrl,
          maintenanceIntervalDays: eq.maintenanceIntervalDays,
          lastMaintenanceAt: eq.lastMaintenanceAt,
          nextMaintenanceAt: eq.nextMaintenanceAt,
          lastCleanedAt: eq.lastCleanedAt,
          needsMaintenance: eq.needsMaintenance ?? false,
          needsCleaning: eq.needsCleaning ?? false,
        },
      });
      created += 1;
    }
  }

  const total = await prisma.gymEquipment.count();
  console.log(`✓ gym equipment seed: ${created} new rows (${total} total)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
