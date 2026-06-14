/**
 * Live DB checks — run with: npm run test:db -- tests/onboardingQuestionnaireCoverage.db.test.js
 * Requires DATABASE_URL + Prisma client (npm run db:generate).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const requireFromHere = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const { extractOnboardingForCoach } = requireFromHere('../src/lib/onboardingForCoach');
const { allCatalogStepIds } = requireFromHere('../src/lib/onboardingQuestionnaireManifest');
const { ONBOARDING_QUESTION_CATALOG } = requireFromHere('../prisma/onboardingCatalogSeed');

describe('onboarding questionnaire — live database', () => {
  it('onboardingData Json column exists on AthleteProfile', () => {
    const schema = readFileSync(join(__dirname, '../prisma/schema.prisma'), 'utf8');
    expect(schema).toMatch(/onboardingData\s+Json\?/);
  });

  it('question catalog seed file covers all wizard step ids', () => {
    const seeded = new Set(ONBOARDING_QUESTION_CATALOG.map((r) => r.stepId));
    const missing = allCatalogStepIds().filter((id) => !seeded.has(id));
    expect(missing).toEqual([]);
  });

  it('onboarding_question_catalog table is seeded (when model exists)', async () => {
    const { prisma } = requireFromHere('../src/db');

    if (typeof prisma.onboardingQuestionCatalog?.findMany !== 'function') {
      console.warn(
        'Skip: add OnboardingQuestionCatalog to schema.prisma and run db:migrate — answers still live in profile.onboardingData JSON',
      );
      return;
    }

    const { seedOnboardingQuestionCatalog } = requireFromHere('../prisma/onboardingCatalogSeed');
    let rows = await prisma.onboardingQuestionCatalog.findMany({ select: { stepId: true } });

    if (rows.length < allCatalogStepIds().length) {
      await seedOnboardingQuestionCatalog(prisma);
      rows = await prisma.onboardingQuestionCatalog.findMany({ select: { stepId: true } });
    }

    const seeded = new Set(rows.map((r) => r.stepId).filter(Boolean));
    const missing = allCatalogStepIds().filter((id) => !seeded.has(id));
    expect(missing, `Run: npm run db:seed — missing ${missing.length} steps`).toEqual([]);
  });

  it('athlete profile onboardingData is readable by AI extractor', async () => {
    const { prisma } = requireFromHere('../src/db');

    const athlete = await prisma.athleteProfile.findFirst({
      where: { onboardingData: { not: null } },
      select: { onboardingData: true, gender: true },
    });

    if (!athlete?.onboardingData) {
      console.warn('Skip: no athlete with onboardingData in DB yet');
      return;
    }

    const od = athlete.onboardingData;
    const metaPattern =
      /^(savedAt|version|inProgress|lastStepId|completedAt|questionnaireVersion|programIntro|progressStepIndex|.*CompletedAt|.*ProgressStepIndex|.*StepIndex|roleWizard|skippedAt|skippedSteps|highTDEE)$/;
    const answerKeys = Object.keys(od).filter((k) => !metaPattern.test(k));

    if (answerKeys.length === 0) {
      console.warn(
        'Skip: onboardingData has progress meta only — complete Core/Workout/Diet/Wellness wizards to populate answers',
      );
      return;
    }

    const extracted = extractOnboardingForCoach(od);
    const total =
      Object.keys(extracted.core).length +
      Object.keys(extracted.workout).length +
      Object.keys(extracted.nutrition).length +
      Object.keys(extracted.health).length +
      Object.keys(extracted.femaleHealth || {}).length;

    expect(total, `Answers present (${answerKeys.join(', ')}) but AI extractor returned empty`).toBeGreaterThan(
      0,
    );
  });
});
