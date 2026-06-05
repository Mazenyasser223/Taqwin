/**
 * Fix active workout plans where training days were saved as rest (scaffold exercises lacked exerciseId).
 *
 *   node scripts/repair-workout-plan-days.js [email]
 */
require('dotenv').config();
const { prisma } = require('../src/db');
const {
  inferIsRestWorkoutDay,
  resolveExercisesForPersist,
  defaultExerciseRowForFocus,
} = require('../src/lib/plans/planWorkoutDay');
const { syncDailyPlansAfterWeeklyPlan } = require('../src/lib/plans/dailyAthletePlanService');

const email = process.argv[2] || 'magdyzeyad54@gmail.com';

async function main() {
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }

  const plan = await prisma.workoutPlan.findFirst({
    where: { userId: user.id, status: 'active' },
    include: {
      days: {
        orderBy: { dayIndex: 'asc' },
        include: { exercises: true },
      },
    },
  });

  if (!plan) {
    console.error('No active workout plan for', email);
    process.exit(1);
  }

  let fixed = 0;
  for (const day of plan.days) {
    const shouldTrain = !inferIsRestWorkoutDay(day);
    const hasExercises = day.exercises.length > 0;

    if (!shouldTrain && day.isRestDay && !hasExercises) continue;

    if (shouldTrain && (!hasExercises || day.isRestDay)) {
      let rows = await resolveExercisesForPersist(prisma, []);
      if (rows.length === 0) {
        const fallback = await defaultExerciseRowForFocus(prisma, {
          focus: day.focus,
          isRest: false,
        });
        if (fallback) rows = [fallback];
      }

      if (rows.length > 0) {
        await prisma.workoutPlanExercise.deleteMany({ where: { dayId: day.id } });
        await prisma.workoutPlanExercise.createMany({
          data: rows.map((r) => ({ ...r, dayId: day.id })),
        });
      }

      await prisma.workoutPlanDay.update({
        where: { id: day.id },
        data: { isRestDay: rows.length === 0 },
      });

      console.log(
        `OK  day ${day.dayIndex} focus=${day.focus} → training=${rows.length > 0} exercises=${rows.length}`
      );
      fixed += 1;
    } else if (shouldTrain && day.isRestDay) {
      await prisma.workoutPlanDay.update({
        where: { id: day.id },
        data: { isRestDay: false },
      });
      console.log(`OK  day ${day.dayIndex} focus=${day.focus} → isRestDay=false`);
      fixed += 1;
    }
  }

  await syncDailyPlansAfterWeeklyPlan(user.id);
  console.log(`Done. ${fixed} day(s) repaired for ${user.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
