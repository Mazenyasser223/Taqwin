/**
 * PlanChangeLog + in-app notifications for manual/chat edits.
 */
const { prisma } = require('../../db');
const { emitAdaptationNotification } = require('./notifyAdaptation');

/**
 * @param {{
 *   userId: string,
 *   changeType: string,
 *   reason?: string,
 *   triggeredBy: string,
 *   beforeSummary?: object,
 *   afterSummary?: object,
 *   locale?: 'ar'|'en',
 *   notify?: boolean,
 * }} args
 */
async function recordPlanChange(args) {
  const row = await prisma.planChangeLog.create({
    data: {
      userId: args.userId,
      changeType: args.changeType,
      reason: args.reason?.slice(0, 2000) || null,
      triggeredBy: args.triggeredBy,
      beforeSummary: args.beforeSummary ?? undefined,
      afterSummary: args.afterSummary ?? undefined,
    },
  });

  if (args.notify !== false) {
    await emitAdaptationNotification({
      userId: args.userId,
      kind: 'plan_change',
      changeType: args.changeType,
      triggeredBy: args.triggeredBy,
      locale: args.locale,
      reason: args.reason,
    });
  }

  return row;
}

module.exports = { recordPlanChange };
