/**
 * Workout questionnaire → coach / plan adaptation notes (life modes, mid-week tweaks).
 */

const { buildExerciseSafetyFilters } = require('./exerciseSafetyFilters');

function str(v) {
  if (v == null || v === '') return null;
  return String(v);
}

function arr(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v) return [v];
  return [];
}

function normLocation(v) {
  const s = String(v ?? '').toLowerCase();
  if (s.includes('home') && !s.includes('gym')) return 'home';
  if (s.includes('gym') && !s.includes('mix')) return 'gym';
  return 'mixed';
}

const OBSTACLE_ADAPT = {
  no_time: 'Life mode: short sessions; 3-day plan; compound priority; minimal accessories',
  low_motivation: 'Life mode: short wins; favorite exercises; flexible skip; light check-ins',
  work_schedule: 'Life mode: flexible AM/PM slots; alternate-day templates; home backup sessions',
  travel: 'Life mode: portable/hotel workouts; minimal equipment; bodyweight circuits',
  recovery: 'Life mode: lower volume; extra rest; deload weeks; no back-to-back hard days',
  pain: 'Life mode: pain-free ROM; regressions; avoid aggravating patterns',
  family: 'Life mode: short home sessions; early AM; weekend anchor days',
};

const DURATION_ADAPT = {
  '30': 'Session: fewer exercises; compound priority; short rests; no excess accessories',
  '45': 'Session: balanced volume and accessories',
  '60': 'Session: room for accessories; optional cardio finisher or mobility',
  '90': 'Session: full accessories; cardio finisher; mobility block OK',
};

const TIME_ADAPT = {
  morning: 'Morning: longer warm-up; lighter first set; simple pre-workout meal',
  evening: 'Evening: avoid late high-stimulant recommendations',
  varies: 'Flexible schedule: no fixed time assumptions in plan',
  afternoon: 'Afternoon: standard warm-up; moderate first-set ramp',
};

const PUSHP_ADAPT = {
  lt12: 'Push baseline low: incline push-ups, machine chest, light dumbbell press',
  '13-20': 'Push baseline moderate: standard progressions',
  gt20: 'Push baseline strong: higher push progressions allowed',
};

const SQUAT_ADAPT = {
  lt12: 'Squat baseline low: box squat, leg press, bodyweight squat',
  '13-20': 'Squat baseline moderate',
  gt20: 'Squat baseline strong',
};

const PULL_ADAPT = {
  '0': 'Pull baseline: lat pulldown, assisted pull-up, band rows',
  lt5: 'Pull baseline low: assisted variations',
  '6_12': 'Pull baseline moderate',
  gt12: 'Pull baseline strong',
};

/**
 * @param {object} od onboarding + merged core answers
 * @returns {string[]}
 */
function buildWorkoutAdaptationNotes(od = {}) {
  const notes = [];
  const location = normLocation(od.workoutLocation);
  const injuries = arr(od.injuries).filter((i) => i !== 'none');
  const safety = buildExerciseSafetyFilters(od);

  if (!safety.active) {
    notes.push('Injuries: none — no exercise safety filters');
  } else {
    notes.push(`Exercise safety filters ON: ${injuries.join(', ') || 'custom'}`);
    if (od.injuriesOther) notes.push(`Other injury detail: ${od.injuriesOther}`);
    for (const [inj, examples] of Object.entries(safety.blockedExamples)) {
      notes.push(`Block ${inj}: ${examples.join(', ')}`);
    }
  }

  if (location === 'home') {
    notes.push('Location home: bodyweight/resistance plan; hide gym max lifts');
  } else if (location === 'gym') {
    notes.push('Location gym: full equipment; gym link optional');
  } else {
    notes.push('Location mixed: home + gym sessions; portable backups');
  }

  const days = str(od.trainingDaysPerWeek);
  if (days) notes.push(`Training days/week: ${days}`);

  const split = str(od.preferredSplit);
  if (split) notes.push(`Preferred split: ${split}`);

  const dur = str(od.workoutDuration);
  if (dur && DURATION_ADAPT[dur]) notes.push(DURATION_ADAPT[dur]);

  const time = str(od.workoutTime);
  if (time && TIME_ADAPT[time]) notes.push(TIME_ADAPT[time]);

  const obstacles = arr(od.trainingObstacle);
  for (const obstacle of obstacles) {
    if (obstacle === 'other' && od.trainingObstacleOther) {
      notes.push(`Training obstacle: ${od.trainingObstacleOther}`);
    } else if (obstacle && OBSTACLE_ADAPT[obstacle]) {
      notes.push(OBSTACLE_ADAPT[obstacle]);
    }
  }

  const eq = arr(od.strengthEquipment);
  if (eq.length === 1 && eq[0] === 'bodyweight') {
    notes.push('Equipment: bodyweight only — no barbell max tests');
  } else if (eq.length) {
    notes.push(`Strength equipment: ${eq.join(', ')}`);
  }

  if (od.addCardio === 'yes' && arr(od.equipment).length) {
    notes.push(`Cardio equipment: ${arr(od.equipment).join(', ')}`);
  } else if (od.addCardio === 'no') {
    notes.push('Cardio: user declined — add only if health goal requires optional cardio');
  }

  const push = str(od.pushups);
  if (push && PUSHP_ADAPT[push]) notes.push(PUSHP_ADAPT[push]);

  const squat = str(od.squats);
  if (squat && SQUAT_ADAPT[squat]) notes.push(SQUAT_ADAPT[squat]);

  const pull = str(od.pullups);
  if (pull && PULL_ADAPT[pull]) notes.push(PULL_ADAPT[pull]);

  if (injuries.some((i) => ['knees', 'ankles'].includes(i)) && arr(od.bodyFocus).some((b) => ['legs', 'glutes'].includes(b))) {
    notes.push('Body focus legs/glutes + knee issue: hip thrust, glute bridge, ham curl; low knee stress');
  }
  if (injuries.includes('shoulders') && arr(od.bodyFocus).includes('shoulders')) {
    notes.push('Body focus shoulders + shoulder issue: rehab-safe stability; no heavy overhead press');
  }

  const pace = str(od.goal12WeekPace);
  const beginner = String(od.fitnessLevel ?? '').toLowerCase().includes('beginner');
  if (pace === 'fast' && (beginner || safety.active || dur === '30')) {
    notes.push('Pace fast requested but constraints present — use safe-aggressive not reckless volume');
  } else if (pace === 'calm') {
    notes.push('Pace calm: lower volume, more recovery, slower progression');
  }

  if (od.restDaysPreference === 'minimal' && (beginner || safety.active || dur === '30')) {
    notes.push('Minimal rest preference capped: not 6-day schedule for beginner/injury/30min sessions');
  }

  if (od.restDaysPreference === 'fixed' && arr(od.fixedRestDays).length) {
    const labels = arr(od.fixedRestDays).map(
      (d) =>
        ({
          sun: 'Sunday',
          mon: 'Monday',
          tue: 'Tuesday',
          wed: 'Wednesday',
          thu: 'Thursday',
          fri: 'Friday',
          sat: 'Saturday',
        })[d] ?? d,
    );
    notes.push(`Fixed rest days: ${labels.join(', ')}`);
  }

  const loves = arr(od.exercisesLove);
  const avoids = arr(od.exercisesAvoid);
  if (loves.length) notes.push('Exercise loves are boosts only when safe and equipment-available');
  if (avoids.length) notes.push(`Exercises avoided: ${avoids.join(', ')}`);
  if (loves.length && safety.active) {
    notes.push('Safety filters override exercise loves (e.g. deadlift blocked with back injury)');
  }

  return notes;
}

module.exports = {
  buildWorkoutAdaptationNotes,
  OBSTACLE_ADAPT,
  DURATION_ADAPT,
  TIME_ADAPT,
};
