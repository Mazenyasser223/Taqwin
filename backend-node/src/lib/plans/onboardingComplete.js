/**
 * Block C4 — Athlete onboarding "profile complete" detection.
 *
 * All four questionnaire flows must be finished (completion timestamps set
 * when the user submits each wizard after required answers are filled).
 */
const FLOW_COMPLETED_KEYS = [
  'coreCompletedAt',
  'workoutPlanCompletedAt',
  'dietPlanCompletedAt',
  'wellnessCompletedAt',
];

/**
 * @param {unknown} onboardingData
 * @returns {onboardingData is Record<string, unknown>}
 */
function asOnboardingObject(onboardingData) {
  return Boolean(onboardingData && typeof onboardingData === 'object' && !Array.isArray(onboardingData));
}

/**
 * Athlete finished every questionnaire flow (all required questions answered per flow).
 * @param {unknown} onboardingData
 */
function isAthleteOnboardingFullyComplete(onboardingData) {
  if (!asOnboardingObject(onboardingData)) return false;
  return FLOW_COMPLETED_KEYS.every((key) => Boolean(onboardingData[key]));
}

/**
 * Transition: was incomplete → now complete (trigger AI plan once).
 * @param {unknown} before
 * @param {unknown} after
 */
function didAthleteOnboardingBecomeComplete(before, after) {
  return (
    !isAthleteOnboardingFullyComplete(before) && isAthleteOnboardingFullyComplete(after)
  );
}

module.exports = {
  FLOW_COMPLETED_KEYS,
  isAthleteOnboardingFullyComplete,
  didAthleteOnboardingBecomeComplete,
};
