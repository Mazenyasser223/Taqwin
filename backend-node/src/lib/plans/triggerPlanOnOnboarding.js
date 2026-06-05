/**
 * Block C4 — Kick off official Postgres plan when athlete onboarding becomes complete.
 */
const { logger } = require('../logger');
const { getOrCreateUserSettings } = require('../userSettings');
const { invalidateContextBundle } = require('../contextBundle');
const { isPlanQueueEnabled, enqueuePlanGenerate } = require('../../jobs/planGenerateJobs');
const { generatePlanForUser } = require('./generator');
const {
  didAthleteOnboardingBecomeComplete,
  isAthleteOnboardingFullyComplete,
} = require('./onboardingComplete');

/**
 * @param {{
 *   userId: string,
 *   role: string,
 *   previousOnboarding: unknown,
 *   nextOnboarding: unknown,
 * }} args
 * @returns {Promise<{
 *   triggered: boolean,
 *   mode?: 'queued'|'background'|'skipped',
 *   jobId?: string,
 *   status?: string,
 *   reason?: string,
 * }>}
 */
async function maybeTriggerPlanOnOnboardingComplete({
  userId,
  role,
  previousOnboarding,
  nextOnboarding,
}) {
  if (role !== 'athlete') {
    return { triggered: false, mode: 'skipped', reason: 'not_athlete' };
  }

  if (!didAthleteOnboardingBecomeComplete(previousOnboarding, nextOnboarding)) {
    if (isAthleteOnboardingFullyComplete(nextOnboarding)) {
      return { triggered: false, mode: 'skipped', reason: 'already_complete' };
    }
    return { triggered: false, mode: 'skipped', reason: 'onboarding_incomplete' };
  }

  const settings = await getOrCreateUserSettings(userId);
  const locale = settings?.language === 'en' ? 'en' : 'ar';

  await invalidateContextBundle(userId);

  if (isPlanQueueEnabled()) {
    const enq = await enqueuePlanGenerate({
      userId,
      locale,
      regenerationReason: 'onboarding_complete',
      source: 'onboarding',
    });

    if (enq.ok) {
      logger.info(
        { userId, jobId: enq.jobId, duplicate: enq.duplicate },
        'AI plan queued after onboarding complete'
      );
      return {
        triggered: true,
        mode: 'queued',
        jobId: enq.jobId,
        status: enq.duplicate ? 'already_queued' : 'queued',
      };
    }

    logger.warn({ userId, reason: enq.reason }, 'plan queue failed after onboarding — background sync');
  }

  setImmediate(() => {
    generatePlanForUser({
      userId,
      locale,
      regenerationReason: 'onboarding_complete',
    })
      .then((result) => {
        logger.info(
          { userId, source: result.source, storage: result.storage },
          'AI plan generated in background after onboarding'
        );
      })
      .catch((err) => {
        logger.error({ err: err.message, userId }, 'background plan generation after onboarding failed');
      });
  });

  return { triggered: true, mode: 'background', status: 'generating' };
}

module.exports = {
  maybeTriggerPlanOnOnboardingComplete,
};
