/* eslint-disable no-console */
require('dotenv').config({ override: true });
/**
 * Verify plans use Postgres only (no Mongo plans collection in read/write path).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const checks = [
  {
    name: 'generator.js does not save to Mongo plans',
    ok: () => {
      const s = read('lib/plans/generator.js');
      return !s.includes("require('./save')") && !s.includes('savePlan(');
    },
  },
  {
    name: 'activePlanService.js does not read Mongo plans',
    ok: () => {
      const s = read('services/activePlanService.js');
      return !s.includes('mongo/models/plan') && !s.includes('fetchActivePlanFromMongo');
    },
  },
  {
    name: 'plan routes use Postgres fetch',
    ok: () => {
      const s = read('routes/ai/plan.js');
      return s.includes('fetchActivePlan') && s.includes('fetchPlanHistoryFromPostgres');
    },
  },
  {
    name: 'planGenerationLog is separate from plans collection',
    ok: () => {
      const s = read('lib/plans/planGenerationLog.js');
      return s.includes('plan_generation_logs') && !s.includes("collection: 'plans'");
    },
  },
];

let failed = 0;
console.log('Storage split verify (C2)\n');
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
console.log('\nStorage split verify PASSED');
