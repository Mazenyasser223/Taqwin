/* eslint-disable no-console */
require('dotenv').config({ override: true });
/**
 * Block C4 verification — onboarding complete → plan generation hook.
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src');

function read(rel) {
  return fs.readFileSync(path.join(src, rel), 'utf8');
}

const checks = [
  {
    name: 'onboardingComplete.js checks four flow timestamps',
    ok: () => {
      const s = read('lib/plans/onboardingComplete.js');
      return (
        s.includes('coreCompletedAt') &&
        s.includes('wellnessCompletedAt') &&
        s.includes('didAthleteOnboardingBecomeComplete')
      );
    },
  },
  {
    name: 'triggerPlanOnOnboarding uses enqueue or background generate',
    ok: () => {
      const s = read('lib/plans/triggerPlanOnOnboarding.js');
      return s.includes('enqueuePlanGenerate') && s.includes('generatePlanForUser');
    },
  },
  {
    name: 'profile PATCH calls maybeTriggerPlanOnOnboardingComplete',
    ok: () => read('routes/profile.js').includes('maybeTriggerPlanOnOnboardingComplete'),
  },
  {
    name: 'frontend persistQuestionnaire no longer calls aiService.generatePlan on diet',
    ok: () => {
      const s = fs.readFileSync(
        path.join(__dirname, '..', '..', 'frontend', 'features', 'onboarding', 'persistQuestionnaire.ts'),
        'utf8'
      );
      return !s.includes('triggerPlanGeneration') && !s.includes("reason: 'diet_questionnaire_completed'");
    },
  },
];

let failed = 0;
console.log('Block C4 verify\n');
for (const c of checks) {
  if (c.ok()) {
    console.log(`OK  ${c.name}`);
  } else {
    console.log(`FAIL ${c.name}`);
    failed += 1;
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nC4 verify PASSED');
