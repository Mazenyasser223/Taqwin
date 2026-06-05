/**
 * Block C2 — official plan validation gate before Postgres persist.
 * Wraps lib/plans/validator.js (Zod shape, macro safety, FK whitelist, exclusions).
 */
const { validatePlan } = require('./validator');

/**
 * @param {object} rawPlan - LLM / FastAPI JSON
 * @param {{ profile: object, onboardingData?: object, maintenanceCalories?: number }} ctx
 * @returns {Promise<{ ok: boolean, errors: string[], plan?: object }>}
 */
async function validatePlanForPersist(rawPlan, ctx = {}) {
  return validatePlan(rawPlan, {
    profile: ctx.profile,
    onboardingData: ctx.onboardingData ?? ctx.profile?.onboardingData,
    maintenanceCalories: ctx.maintenanceCalories,
  });
}

module.exports = {
  validatePlanForPersist,
  validatePlan,
};
