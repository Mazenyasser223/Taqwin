/**
 * @deprecated Prefer ragRetrieve({ purpose: 'plan_catalog', kind: 'exercise' }).
 * Re-exports catalog SQL helpers + prompt formatting for backward compatibility.
 */
const { ragRetrieve, formatExerciseLineForPrompt } = require('./ragRetrieve');
const {
  retrieveExercisesSql,
  filterExerciseCandidates,
  scoreExerciseRow,
  normaliseExerciseRow,
} = require('./catalogExercise');

async function retrieveExercises({
  onboardingData = {},
  profile,
  message,
  muscleGroup,
  limit = 40,
  traceId,
} = {}) {
  const { items } = await ragRetrieve({
    purpose: 'plan_catalog',
    kind: 'exercise',
    query: message,
    onboardingData,
    profile,
    muscleGroup,
    limit,
    traceId,
  });
  return items;
}

module.exports = {
  retrieveExercises,
  retrieveExercisesSql,
  filterExerciseCandidates,
  scoreExerciseRow,
  normaliseExerciseRow,
  formatExerciseLineForPrompt,
};
