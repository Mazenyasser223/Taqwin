/* eslint-disable no-console */
/**
 * Print a human-readable summary of the user's active plan.
 *   node scripts/print-active-plan.js mazenyasser223@gmail.com
 */
require('dotenv').config({ override: true });

const { prisma } = require('../src/db');
const { fetchActivePlan } = require('../src/services/activePlanService');

function summarize(plan) {
  const out = [];
  out.push('=== DAILY TARGETS ===');
  out.push(JSON.stringify(plan.dailyTargets, null, 2));
  out.push('');
  out.push('=== COACH NOTES ===');
  out.push(plan.coachNotes || plan.explainabilityText || '(none)');
  out.push('');
  out.push('=== DIET (7 days) ===');
  for (const day of plan.dietDays || []) {
    out.push(`Day ${day.dayIndex}: ${day.label || ''}`);
    for (const meal of day.meals || []) {
      const items = (meal.items || meal.foods || [])
        .map((i) => `${i.name} ${i.grams || 0}g`)
        .join(', ');
      out.push(`  ${meal.slot}: ${items || '(empty)'}`);
    }
    out.push('');
  }
  out.push('=== WORKOUT WEEK 1 ===');
  const wk = (plan.workoutWeeks || [])[0];
  if (wk) {
    for (const day of wk.days || []) {
      if (day.isRest) {
        out.push(`Day ${day.dayIndex}: REST`);
      } else {
        const exs = (day.exercises || [])
          .map((e) => `${e.name} ${e.sets}x${e.reps}`)
          .join(', ');
        out.push(`Day ${day.dayIndex} [${day.type}]: ${exs}`);
      }
    }
  }
  return out.join('\n');
}

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node scripts/print-active-plan.js <email>');
    process.exit(1);
  }
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }
  const plan = await fetchActivePlan(user.id);
  if (!plan) {
    console.error('No active plan for', email);
    process.exit(1);
  }
  console.log('source:', plan.source, '| version:', plan.version);
  console.log(summarize(plan));
}

main()
  .catch((err) => {
    console.error('FAIL', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
