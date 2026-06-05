/* eslint-disable no-console */
/**
 * Regenerate active plan via Claude (RAG + CAG). No dashboard wipe.
 *
 *   node scripts/regenerate-claude-plan.js [email]
 */
require('dotenv').config({ override: true });

const { prisma } = require('../src/db');
const { generatePlanForUser } = require('../src/lib/plans/generator');

async function main() {
  const email = (process.argv[2] || 'magdyzeyad54@gmail.com').trim().toLowerCase();
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  console.log('Generating Claude plan for', email);
  const result = await generatePlanForUser({
    userId: user.id,
    locale: 'ar',
    regenerationReason: 'claude_regenerate_script',
  });

  console.log('OK', {
    source: result.source,
    attempts: result.attempts,
    storage: result.storage,
    explainability: result.plan?.explainabilityText?.slice(0, 120),
    errors: result.errors?.slice(0, 2),
  });
}

main()
  .catch((err) => {
    console.error('FAIL', err.message);
    if (err.validationErrors) console.error(err.validationErrors.slice(0, 5));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
