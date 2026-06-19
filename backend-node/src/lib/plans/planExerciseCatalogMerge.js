/**
 * Merge onboarding exercise picks + staple catalog + RAG exercises.
 */
const { loadGroupConfig } = require('./planStapleExercises');

function exerciseDedupeKey(item) {
  const id = item.id || item.exerciseId;
  if (id) return `ex:${id}`;
  return `n:${String(item.name || '').toLowerCase().trim()}`;
}

function inferMuscleGroup(item) {
  if (item.muscleGroup) return item.muscleGroup;
  const zone = String(item.browseMuscleZone || '').toLowerCase();
  const config = loadGroupConfig();
  for (const [groupKey, def] of Object.entries(config.groups)) {
    if ((def.zones || []).includes(zone)) return groupKey;
  }
  return 'other';
}

function mergePlanExerciseCatalog(...layers) {
  const seen = new Set();
  const out = [];
  for (const layer of layers) {
    for (const raw of layer || []) {
      const item = {
        ...raw,
        muscleGroup: inferMuscleGroup(raw),
        planDifficulty: raw.planDifficulty || raw.difficulty || 'intermediate',
      };
      const key = exerciseDedupeKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

module.exports = {
  mergePlanExerciseCatalog,
  exerciseDedupeKey,
  inferMuscleGroup,
};
