const { PrismaClient } = require('@prisma/client');
const { seedOnboardingQuestionCatalog } = require('../prisma/onboardingCatalogSeed');

const prisma = new PrismaClient();

seedOnboardingQuestionCatalog(prisma)
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
