require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const coords = [
  { loc: 'Cairo, Maadi', lat: 30.0128, lng: 31.2819 },
  { loc: 'Alexandria, Smouha', lat: 31.2156, lng: 29.9425 },
  { loc: 'Giza, Sheikh Zayed', lat: 30.0287, lng: 30.9783 },
];

async function main() {
  for (const c of coords) {
    const r = await prisma.gym.updateMany({
      where: { location: c.loc },
      data: { latitude: c.lat, longitude: c.lng },
    });
    console.log(c.loc, 'updated', r.count);
  }
  const gyms = await prisma.gym.findMany({
    select: { name: true, location: true, latitude: true, longitude: true },
  });
  console.log(JSON.stringify(gyms, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
