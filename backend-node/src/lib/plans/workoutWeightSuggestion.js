/**
 * Suggested first-set working weight from onboarding max lifts + exercise pattern.
 * Used on dashboard when athlete provided benchMax / deadliftMax.
 */

const REP_PCT_1RM = {
  5: 0.87,
  6: 0.85,
  8: 0.8,
  10: 0.75,
  12: 0.7,
  15: 0.65,
};

const PLATE_KG = 2.5;

function parseMaxKg(value) {
  if (value == null || value === '' || value === 'unknown') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function pct1rmForReps(reps) {
  const r = Math.round(Number(reps) || 10);
  if (REP_PCT_1RM[r]) return REP_PCT_1RM[r];
  if (r <= 5) return 0.87;
  if (r >= 15) return 0.65;
  return 0.87 - ((r - 5) / 10) * (0.87 - 0.65);
}

function roundToPlate(kg) {
  if (!Number.isFinite(kg) || kg <= 0) return null;
  return Math.max(PLATE_KG, Math.round(kg / PLATE_KG) * PLATE_KG);
}

function estimateSquatMax(deadliftMax, benchMax) {
  if (deadliftMax) return deadliftMax * 0.85;
  if (benchMax) return benchMax * 1.25;
  return null;
}

/** @returns {{ anchor: string, factor: number } | null} */
function classifyExercise(name, category) {
  const n = String(name || '').toLowerCase();
  const cat = String(category || '').toLowerCase();

  if (/push.?up|pull.?up|chin.?up|dip|plank|crunch|sit.?up|burpee|cardio|stretch/.test(n)) {
    return null;
  }

  if (/deadlift|romanian|rdl|good morning|hip thrust|glute bridge/.test(n)) {
    const factor = /romanian|rdl|stiff/.test(n) ? 0.72 : 0.95;
    return { anchor: 'deadlift', factor };
  }

  if (/squat|leg press|hack squat|split squat|lunge|step.?up/.test(n)) {
    const factor = /leg press/.test(n) ? 1.35 : /split|lunge|step/.test(n) ? 0.55 : 0.9;
    return { anchor: 'squat', factor };
  }

  if (/bench|chest press|fly|pushdown|triceps extension|skull/.test(n)) {
    let factor = 0.95;
    if (/incline/.test(n)) factor = 0.82;
    else if (/decline/.test(n)) factor = 0.88;
    else if (/dumbbell/.test(n)) factor = 0.42;
    else if (/cable|machine|smith/.test(n)) factor = 0.88;
    else if (/fly|pec deck/.test(n)) factor = 0.35;
    else if (/triceps|pushdown|skull/.test(n)) factor = 0.38;
    return { anchor: 'bench', factor };
  }

  if (/overhead|shoulder press|military|arnold/.test(n)) {
    const factor = /dumbbell/.test(n) ? 0.28 : 0.55;
    return { anchor: 'bench', factor };
  }

  if (/row|pulldown|pull.?down|lat |pull over|face pull/.test(n)) {
    const factor = /dumbbell/.test(n) ? 0.35 : /cable|machine|lat pulldown/.test(n) ? 0.65 : 0.55;
    return { anchor: 'pull', factor };
  }

  if (/curl|hammer|preacher/.test(n)) {
    return { anchor: 'bench', factor: /dumbbell/.test(n) ? 0.18 : 0.32 };
  }

  if (/lateral raise|front raise|rear delt|reverse fly/.test(n)) {
    return { anchor: 'bench', factor: 0.12 };
  }

  if (cat.includes('legs') || cat.includes('quads') || cat.includes('hamstring')) {
    return { anchor: 'squat', factor: 0.75 };
  }
  if (cat.includes('chest') || cat.includes('push')) {
    return { anchor: 'bench', factor: 0.85 };
  }
  if (cat.includes('back') || cat.includes('pull')) {
    return { anchor: 'pull', factor: 0.6 };
  }
  if (cat.includes('shoulder')) {
    return { anchor: 'bench', factor: 0.5 };
  }

  return null;
}

function anchorMaxKg(anchor, benchMax, deadliftMax, squatMax) {
  switch (anchor) {
    case 'bench':
      return benchMax;
    case 'deadlift':
      return deadliftMax;
    case 'squat':
      return squatMax;
    case 'pull':
      if (deadliftMax) return deadliftMax * 0.55;
      if (benchMax) return benchMax * 0.65;
      return null;
    default:
      return null;
  }
}

function suggestFromBodyweightBaselines(exercise, onboarding) {
  const level = String(onboarding.fitnessLevel || '').toLowerCase();
  const isBeginner = level.includes('beginner') || !level;
  const n = String(exercise.name || '').toLowerCase();

  if (/dumbbell/.test(n)) {
    if (/curl|lateral|raise/.test(n)) return isBeginner ? 4 : 8;
    if (/press|row/.test(n)) return isBeginner ? 8 : 14;
  }
  if (/machine|cable/.test(n)) return isBeginner ? 15 : 25;
  if (/barbell/.test(n) && !/bench|squat|deadlift/.test(n)) return isBeginner ? 20 : 30;
  return null;
}

/**
 * @param {{ name: string, reps?: number, category?: string | null }} exercise
 * @param {Record<string, unknown>} onboarding
 * @returns {number | null} suggested kg for first working set
 */
function suggestFirstSetWeightKg(exercise, onboarding = {}) {
  const benchMax = parseMaxKg(onboarding.benchMax);
  const deadliftMax = parseMaxKg(onboarding.deadliftMax);
  const squatMax = estimateSquatMax(deadliftMax, benchMax);

  const classification = classifyExercise(exercise.name, exercise.category);
  if (!classification) {
    if (!benchMax && !deadliftMax) {
      return suggestFromBodyweightBaselines(exercise, onboarding);
    }
    return null;
  }

  const anchor = anchorMaxKg(
    classification.anchor,
    benchMax,
    deadliftMax,
    squatMax
  );
  if (!anchor) {
    return suggestFromBodyweightBaselines(exercise, onboarding);
  }

  const reps = Number(exercise.reps) || 10;
  const pct = pct1rmForReps(reps);
  const raw = anchor * classification.factor * pct * 0.95;
  return roundToPlate(raw);
}

/**
 * @param {Array<Record<string, unknown>>} exercises
 * @param {Record<string, unknown>} onboarding
 */
function enrichExercisesWithWeightSuggestions(exercises, onboarding = {}) {
  if (!Array.isArray(exercises) || !exercises.length) return exercises;
  return exercises.map((ex) => {
    const suggestedStartKg = suggestFirstSetWeightKg(ex, onboarding);
    if (suggestedStartKg == null) return ex;
    return { ...ex, suggestedStartKg };
  });
}

module.exports = {
  suggestFirstSetWeightKg,
  enrichExercisesWithWeightSuggestions,
  classifyExercise,
  pct1rmForReps,
  roundToPlate,
};
