/**
 * Daily macro targets — back-compat wrapper that delegates to the unified
 * planning module at `lib/plans/targets.js`.
 *
 * Kept so existing callers (dashboard, coach context) keep working unchanged.
 */
const {
  estimateDailyTargets,
  ageFromDateOfBirth,
  waterTargetMl,
} = require('./plans/targets');

function estimateTargets(profile) {
  return estimateDailyTargets(profile, profile?.onboardingData);
}

module.exports = {
  estimateTargets,
  ageFromDateOfBirth,
  waterTargetMl,
};
