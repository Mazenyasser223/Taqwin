/**
 * Exercise safety filters from onboarding injuries + adaptive workout context.
 * Used by RAG exercise search, plan validation, replacement, and coach advice.
 */

/** Injury keys → regex of exercise names that should be excluded */
const INJURY_BLOCKED_PATTERNS = {
  back: /deadlift|good\s*morning|bent[-\s]*over|barbell row|jefferson|stiff[-\s]*leg|hyperextension/i,
  lower_back: /deadlift|good\s*morning|bent[-\s]*over|barbell row|stiff[-\s]*leg|hyperextension/i,
  upper_back: /shrug|barbell row|behind\s*neck/i,
  knees: /jump|jumping|sprint|deep\s*squat|pistol\s*squat|bulgarian\s*split|burpee|box\s*jump/i,
  hips: /deep\s*squat|sumo\s*deadlift|wide\s*stance|hip\s*thrust/i,
  shoulders:
    /overhead press|military press|behind\s*neck|upright row|snatch|jerk|handstand|push\s*press/i,
  neck: /shrug|behind\s*neck|wrestler|neck\s*curl/i,
  chest: /bench\s*press|fly|dips|push[-\s]*up/i,
  arms: /heavy\s*curl|preacher\s*curl|skull\s*crusher/i,
  elbows: /skull\s*crusher|close[-\s]*grip\s*bench|dips?|french\s*press/i,
  wrists: /handstand|planche|wrist\s*curl|reverse\s*curl|barbell\s*press/i,
  ankles: /jump|sprint|box\s*jump|calf\s*raise/i,
  legs: /squat|lunge|deadlift|leg\s*press|jump/i,
};

const INJURY_BLOCK_EXAMPLES = {
  back: ['deadlift', 'bent-over row', 'good morning', 'heavy squat'],
  lower_back: ['deadlift', 'bent-over row', 'good morning'],
  upper_back: ['heavy shrug', 'behind-neck press'],
  knees: ['deep squat', 'jumping', 'box jump', 'pistol squat'],
  shoulders: ['overhead press', 'behind-neck press', 'upright row'],
  neck: ['heavy shrug', 'behind-neck press'],
  elbows: ['skull crusher', 'dips', 'close-grip bench'],
  wrists: ['barbell press', 'handstand', 'heavy wrist curl'],
  ankles: ['jumping', 'sprint', 'box jump'],
  hips: ['deep squat', 'sumo deadlift', 'heavy hip thrust'],
  legs: ['heavy squat', 'jumping lunges'],
  arms: ['heavy preacher curl'],
};

function asLowerArray(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase()).filter(Boolean);
  if (typeof v === 'string' && v) return [v.toLowerCase()];
  return [];
}

function injuryList(onboardingData = {}) {
  return asLowerArray(onboardingData.injuries).filter((i) => i && i !== 'none');
}

function otherInjuryKeywords(onboardingData = {}) {
  const raw = String(onboardingData.injuriesOther ?? '').trim();
  if (!raw) return [];
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 3);
}

function matchesOtherInjury(exerciseName, keywords) {
  if (!exerciseName || !keywords.length) return null;
  const text = String(exerciseName).toLowerCase();
  for (const kw of keywords) {
    if (text.includes(kw)) return kw;
  }
  return null;
}

/**
 * @param {object} onboardingData
 * @returns {{
 *   active: boolean,
 *   injuries: string[],
 *   injuriesOther: string|null,
 *   patterns: Record<string, RegExp>,
 *   blockedExamples: Record<string, string[]>,
 *   otherKeywords: string[],
 * }}
 */
function buildExerciseSafetyFilters(onboardingData = {}) {
  const injuries = injuryList(onboardingData);
  const otherKeywords = otherInjuryKeywords(onboardingData);
  const active = injuries.length > 0 || otherKeywords.length > 0;

  const patterns = {};
  const blockedExamples = {};
  for (const inj of injuries) {
    if (INJURY_BLOCKED_PATTERNS[inj]) patterns[inj] = INJURY_BLOCKED_PATTERNS[inj];
    if (INJURY_BLOCK_EXAMPLES[inj]) blockedExamples[inj] = INJURY_BLOCK_EXAMPLES[inj];
  }

  return {
    active,
    injuries,
    injuriesOther: onboardingData.injuriesOther ? String(onboardingData.injuriesOther) : null,
    patterns,
    blockedExamples,
    otherKeywords,
  };
}

/**
 * Returns injury key (or other keyword) that blocks exercise, or null.
 */
function isExerciseBlockedBySafety(exerciseName, onboardingDataOrFilters = {}) {
  const filters =
    onboardingDataOrFilters.patterns != null
      ? onboardingDataOrFilters
      : buildExerciseSafetyFilters(onboardingDataOrFilters);

  if (!filters.active) return null;
  const text = String(exerciseName || '');
  if (!text) return null;

  for (const inj of filters.injuries) {
    const pattern = filters.patterns[inj] || INJURY_BLOCKED_PATTERNS[inj];
    if (pattern && pattern.test(text)) return inj;
  }

  const otherHit = matchesOtherInjury(text, filters.otherKeywords);
  if (otherHit) return `other:${otherHit}`;

  return null;
}

/** Cardio equipment options safe for current injuries */
function filterCardioEquipmentOptions(equipmentValues, onboardingData = {}) {
  const injuries = injuryList(onboardingData);
  const blocked = {
    rower: ['back', 'lower_back', 'upper_back'],
    stepper: ['knees', 'ankles'],
  };
  return (equipmentValues || []).filter((eq) => {
    const avoid = blocked[eq];
    if (!avoid) return true;
    return !avoid.some((inj) => injuries.includes(inj));
  });
}

module.exports = {
  INJURY_BLOCKED_PATTERNS,
  INJURY_BLOCK_EXAMPLES,
  buildExerciseSafetyFilters,
  isExerciseBlockedBySafety,
  filterCardioEquipmentOptions,
  injuryList,
};
