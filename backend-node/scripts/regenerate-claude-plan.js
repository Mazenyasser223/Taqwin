/* eslint-disable no-console */
/**
 * Regenerate active plan via Claude (RAG + CAG). No dashboard wipe.
 *
 *   node scripts/regenerate-claude-plan.js [email]
 */
require('dotenv').config({ override: true });

const { prisma } = require('../src/db');
const { generatePlanForUser } = require('../src/lib/plans/generator');

function parseLocale(argv) {
  const flag = argv.find((a) => a.startsWith('--locale='));
  if (flag) return flag.split('=')[1].trim().toLowerCase() === 'en' ? 'en' : 'ar';
  const env = String(process.env.PLAN_CATALOG_LOCALE || 'en').toLowerCase();
  return env === 'en' ? 'en' : 'ar';
}

async function main() {
  const rawArgv = process.argv.slice(2);
  const emailArg = rawArgv.find((a) => !a.startsWith('--')) || 'magdyzeyad54@gmail.com';
  const email = emailArg.trim().toLowerCase();
  const locale = parseLocale(rawArgv);
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  console.log('Generating Claude plan for', email, { locale });
  const result = await generatePlanForUser({
    userId: user.id,
    locale,
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
