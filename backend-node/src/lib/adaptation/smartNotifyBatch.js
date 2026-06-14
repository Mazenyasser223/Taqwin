/**
 * Block D10 — batch smart-notification sweep.
 *
 * Evaluates every athlete with an active plan. The per-user logic self-gates by
 * local time and meal windows, and dedupes per slot per day, so this can run on
 * a simple hourly tick without a strict timezone window.
 */
const { prisma } = require('../../db');
const { logger } = require('../logger');
const { runSmartNotificationsForUser } = require('./smartNotify');

async function listAthletesWithActivePlans({ limit = 2000 } = {}) {
  const rows = await prisma.user.findMany({
    where: {
      role: 'athlete',
      OR: [
        { workoutPlans: { some: { status: 'active' } } },
        { dietPlans: { some: { status: 'active' } } },
      ],
    },
    select: {
      id: true,
      settings: { select: { language: true, timezone: true } },
    },
    take: limit,
  });
  return rows.map((u) => ({
    userId: u.id,
    locale: u.settings?.language === 'en' ? 'en' : 'ar',
    timezone: u.settings?.timezone || 'UTC',
  }));
}

/**
 * @param {{ dryRun?: boolean, now?: Date, limit?: number }} [opts]
 */
async function runSmartNotifyBatch(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const now = opts.now || new Date();

  const athletes = await listAthletesWithActivePlans({ limit: opts.limit });
  let scanned = 0;
  let emitted = 0;
  let usersNotified = 0;

  for (const athlete of athletes) {
    scanned += 1;
    try {
      const result = await runSmartNotificationsForUser(athlete.userId, {
        now,
        dryRun,
        locale: athlete.locale,
        timezone: athlete.timezone,
      });
      if (result.ok && result.emitted > 0) {
        emitted += result.emitted;
        usersNotified += 1;
      }
    } catch (err) {
      logger.warn({ err: err.message, userId: athlete.userId }, 'smart notify (user) failed');
    }
  }

  if (emitted > 0 || dryRun) {
    logger.info({ scanned, emitted, usersNotified, dryRun }, 'smart notify batch complete');
  }
  return { ok: true, scanned, emitted, usersNotified, dryRun };
}

module.exports = { runSmartNotifyBatch, listAthletesWithActivePlans };
