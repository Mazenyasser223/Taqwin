/**
 * Ensure 3 seed gyms with map coordinates exist for map testing.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PASSWORD = 'Taqwin#2025';

const GYMS = [
  { ownerEmail: 'iron.house@taqwin.app', ownerName: 'Iron House', name: 'Iron House Gym', location: 'Cairo, Maadi', phone: '+20 100 111 2222', maxCapacity: 250, amenities: 'Free weights, Sauna, Showers', latitude: 30.0128, longitude: 31.2819 },
  { ownerEmail: 'pulse.fit@taqwin.app', ownerName: 'Pulse Fitness', name: 'Pulse Fitness Studio', location: 'Alexandria, Smouha', phone: '+20 100 333 4444', maxCapacity: 180, amenities: 'Yoga, Spin, Crossfit Box', latitude: 31.2156, longitude: 29.9425 },
  { ownerEmail: 'flow.studio@taqwin.app', ownerName: 'Flow Studio', name: 'Flow Yoga & Pilates', location: 'Giza, Sheikh Zayed', phone: '+20 100 555 6666', maxCapacity: 80, amenities: 'Heated Yoga, Pilates', latitude: 30.0287, longitude: 30.9783 },
];

async function upsertOwner(g) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: g.ownerEmail },
    update: { role: 'gym', passwordHash, emailVerifiedAt: new Date() },
    create: {
      email: g.ownerEmail,
      role: 'gym',
      passwordHash,
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          displayName: g.ownerName,
          businessName: g.name,
          businessAddress: g.location,
          businessPhone: g.phone,
        },
      },
    },
    include: { profile: true },
  });
  if (!user.profile) {
    await prisma.profile.create({
      data: {
        userId: user.id,
        displayName: g.ownerName,
        businessName: g.name,
        businessAddress: g.location,
        businessPhone: g.phone,
      },
    });
  }
  return user;
}

async function main() {
  for (const g of GYMS) {
    const owner = await upsertOwner(g);
    let gym = await prisma.gym.findFirst({ where: { ownerId: owner.id } });
    if (!gym) {
      gym = await prisma.gym.create({
        data: {
          ownerId: owner.id,
          name: g.name,
          location: g.location,
          phone: g.phone,
          maxCapacity: g.maxCapacity,
          amenities: g.amenities,
          latitude: g.latitude,
          longitude: g.longitude,
          isActive: true,
        },
      });
      console.log('Created', gym.name);
    } else {
      gym = await prisma.gym.update({
        where: { id: gym.id },
        data: {
          name: g.name,
          location: g.location,
          latitude: g.latitude,
          longitude: g.longitude,
          isActive: true,
        },
      });
      console.log('Updated', gym.name);
    }
  }

  const athleteHash = await bcrypt.hash(PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: 'demo@taqwin.app' },
    update: { role: 'athlete', passwordHash: athleteHash, emailVerifiedAt: new Date() },
    create: {
      email: 'demo@taqwin.app',
      role: 'athlete',
      passwordHash: athleteHash,
      emailVerifiedAt: new Date(),
      profile: { create: { displayName: 'Demo Athlete' } },
    },
  });
  console.log('Athlete demo@taqwin.app ready');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
