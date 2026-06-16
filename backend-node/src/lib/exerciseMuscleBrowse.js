/**
 * Exercise library muscle browse — one canonical zone per exercise.
 * Keep in sync with frontend/features/workouts/exerciseMuscleBrowse.ts
 */

/** Lower number = wins when exercise tags multiple muscle labels. */
const ZONE_PRIORITY = {
  chest: 10,
  lats: 20,
  lowerback: 21,
  trapsmiddle: 22,
  traps: 23,
  frontshoulders: 30,
  rearshoulders: 31,
  shoulders: 32,
  biceps: 40,
  triceps: 41,
  forearms: 42,
  obliques: 50,
  abdominals: 51,
  abs: 52,
  quads: 60,
  hamstrings: 61,
  calves: 62,
  glutes: 63,
};

const EXERCISE_MUSCLE_BROWSE_TO_LABELS = {
  chest: ['Chest', 'Upper Pectoralis', 'Mid and Lower Chest'],
  shoulders: ['Shoulders', 'Lateral Deltoid'],
  biceps: ['Biceps', 'Long Head Bicep', 'Short Head Bicep'],
  triceps: ['Triceps', 'Long Head Tricep'],
  forearms: ['Forearms', 'Wrist Extensors', 'Wrist Flexors', 'Hands', 'Fingers', 'Grip'],
  abs: ['Abdominals'],
  quads: ['Quads', 'Rectus Femoris', 'Inner Quadriceps', 'Outer Quadricep', 'Inner Thigh'],
  hamstrings: ['Hamstrings', 'Lateral Hamstrings', 'Medial Hamstrings'],
  calves: ['Calves', 'Gastrocnemius', 'Soleus', 'Tibialis', 'Feet'],
  glutes: ['Glutes', 'Gluteus Maximus', 'Gluteus Medius', 'Groin'],
  lats: ['Lats'],
  lowerback: ['Lower back'],
  traps: ['Traps', 'Upper Traps', 'Lower Traps', 'Neck'],
  trapsmiddle: ['Traps (mid-back)', 'Mid back'],
  frontshoulders: ['Anterior Deltoid', 'Front Shoulders'],
  rearshoulders: ['Posterior Deltoid', 'Rear Shoulders'],
  abdominals: ['Upper Abdominals', 'Lower Abdominals'],
  obliques: ['Obliques'],
};

const EXERCISE_MUSCLE_BROWSE_ZONES = [
  'chest',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'calves',
  'glutes',
  'lats',
  'lowerback',
  'traps',
  'trapsmiddle',
  'frontshoulders',
  'rearshoulders',
  'abdominals',
  'obliques',
];

/** Each DB label maps to exactly one browse zone (first zone wins on duplicate). */
const LABEL_TO_BROWSE_ZONE = {};
for (const zone of EXERCISE_MUSCLE_BROWSE_ZONES) {
  for (const label of EXERCISE_MUSCLE_BROWSE_TO_LABELS[zone] || []) {
    if (!LABEL_TO_BROWSE_ZONE[label]) LABEL_TO_BROWSE_ZONE[label] = zone;
  }
}

/** Fallback when primary_muscles is empty — match exercise name (lowercase). */
const NAME_HINTS = [
  { pattern: /\bchest\b|\bbench press\b|\bdumbbell press\b|\bincline press\b|\bpush-up\b|\bpushup\b|\bflye?\b|\bpec\b/, zone: 'chest' },
  { pattern: /\bbicep\b|\bcurl\b|\bchin-up\b|\bchin up\b/, zone: 'biceps' },
  { pattern: /\btricep\b|\bskull crusher\b|\bkickback\b|\bpushdown\b/, zone: 'triceps' },
  { pattern: /\blat pulldown\b|\bpull-up\b|\bpullup\b|\brow\b|\bdeadlift\b/, zone: 'lats' },
  { pattern: /\bsquat\b|\bleg press\b|\bquad\b|\blunge\b/, zone: 'quads' },
  { pattern: /\bhamstring\b|\bromanian\b|\bleg curl\b|\bnordic\b/, zone: 'hamstrings' },
  { pattern: /\bcalf\b|\bcalves\b/, zone: 'calves' },
  { pattern: /\bglute\b|\bhip thrust\b/, zone: 'glutes' },
  { pattern: /\bshoulder\b|\blateral raise\b|\boverhead press\b|\bmilitary press\b|\barnold\b/, zone: 'shoulders' },
  { pattern: /\bab\b|\babs\b|\bcrunch\b|\bplank\b|\bsit-up\b|\bsitup\b|\bleg raise\b/, zone: 'abs' },
  { pattern: /\boblique\b|\brussian twist\b/, zone: 'obliques' },
  { pattern: /\bforearm\b|\bwrist curl\b|\bgrip\b|\bfinger\b|\bhand\b|\bfarmer\b/, zone: 'forearms' },
  { pattern: /\bshrug\b|\btrap\b|\bface pull\b|\bcervical\b|\bchin tuck\b|\bneck\b/, zone: 'traps' },
  { pattern: /\brotator cuff\b|\bexternal rotation\b/, zone: 'rearshoulders' },
  { pattern: /\bscapular\b|\bintrascapular\b|\bmid back\b|\btraps mid back\b/, zone: 'trapsmiddle' },
  { pattern: /\bmedian nerve\b|\bradial deviation\b/, zone: 'forearms' },
];

function normalizeMuscleList(primaryMuscles) {
  if (!Array.isArray(primaryMuscles)) return [];
  return primaryMuscles.map((m) => String(m || '').trim()).filter(Boolean);
}

/**
 * Assign exactly one browse zone per exercise.
 * When multiple labels match, the zone with the lowest ZONE_PRIORITY wins.
 */
function assignBrowseMuscleZone(primaryMuscles, exerciseName = '') {
  const muscles = normalizeMuscleList(primaryMuscles).filter((m) => m !== 'General');
  const matchedZones = new Set();

  for (const muscle of muscles) {
    const zone = LABEL_TO_BROWSE_ZONE[muscle];
    if (zone) matchedZones.add(zone);
  }

  if (matchedZones.size === 0) {
    const name = String(exerciseName || '').toLowerCase();
    for (const hint of NAME_HINTS) {
      if (hint.pattern.test(name)) return hint.zone;
    }
    return null;
  }

  let best = null;
  let bestPri = Infinity;
  for (const zone of matchedZones) {
    const pri = ZONE_PRIORITY[zone] ?? 999;
    if (pri < bestPri) {
      bestPri = pri;
      best = zone;
    }
  }
  return best;
}

function browseLabelsForZone(zone) {
  if (!zone) return null;
  return EXERCISE_MUSCLE_BROWSE_TO_LABELS[zone] ?? null;
}

module.exports = {
  ZONE_PRIORITY,
  EXERCISE_MUSCLE_BROWSE_TO_LABELS,
  EXERCISE_MUSCLE_BROWSE_ZONES,
  LABEL_TO_BROWSE_ZONE,
  assignBrowseMuscleZone,
  browseLabelsForZone,
};
