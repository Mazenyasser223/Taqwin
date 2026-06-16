/**
 * Assign fitness_goals tags on exercises (lose-weight, gain-strength, gain-muscle).
 * Usage: node scripts/backfill-exercise-fitness-goals.js
 */
const { PrismaClient } = require('../generated/prisma');
const { classifyExerciseFitnessGoals } = require('../src/lib/exerciseFitnessGoals');

const prisma = new PrismaClient();
const BATCH = 100;

async function main() {
  const rows = await prisma.exercise.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      name: true,
      category: true,
      mechanic: true,
      difficulty: true,
    },
  });

  const tally = { 'lose-weight': 0, 'gain-strength': 0, 'gain-muscle': 0, untagged: 0 };

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map((row) => {
        const goals = classifyExerciseFitnessGoals(row);
        if (!goals.length) tally.untagged++;
        for (const g of goals) tally[g]++;
        return prisma.exercise.update({
          where: { id: row.id },
          data: { fitnessGoals: goals },
        });
      }),
    );
    console.log(`Updated ${Math.min(i + BATCH, rows.length)}/${rows.length}…`);
  }

  console.log(JSON.stringify({ updated: rows.length, tally }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
