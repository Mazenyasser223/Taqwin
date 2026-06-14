require('dotenv').config();
const { prisma } = require('../src/db');
const { extractOnboardingForCoach } = require('../src/lib/onboardingForCoach');

(async () => {
  const row = await prisma.athleteProfile.findFirst({
    where: { onboardingData: { not: null } },
    select: { onboardingData: true, gender: true },
  });
  if (!row) {
    console.log('No athlete with onboardingData');
    return;
  }
  const od = row.onboardingData;
  console.log('onboardingData keys:', Object.keys(od || {}).length);
  console.log('first keys:', Object.keys(od || {}).slice(0, 25));
  const extracted = extractOnboardingForCoach(od);
  console.log('AI sections:', {
    core: Object.keys(extracted.core).length,
    workout: Object.keys(extracted.workout).length,
    nutrition: Object.keys(extracted.nutrition).length,
    health: Object.keys(extracted.health).length,
    femaleHealth: Object.keys(extracted.femaleHealth || {}).length,
  });
})()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
