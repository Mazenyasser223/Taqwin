/**
 * Extract onboarding questionnaire answers for AI coach / CAG (Block A5).
 * Field lists mirror frontend `features/onboarding/flows/orders.ts`.
 */

const { buildExerciseSafetyFilters } = require('./plans/exerciseSafetyFilters');
const { buildWorkoutAdaptationNotes } = require('./plans/workoutAdaptationContext');
const { buildNutritionAdaptationNotes } = require('./plans/nutritionAdaptationContext');
const { buildFemaleHealthAdaptationNotes } = require('./plans/femaleHealthAdaptationContext');

const CORE_FIELDS = [
  'displayName',
  'gender',
  'needsFemaleWellness',
  'age',
  'phone',
  'height',
  'weight',
  'weightHistory',
  'bodyType',
  'bodyMeasurements',
  'primaryGoal',
  'targetWeight',
  'goalDeadline',
  'activityLevel',
  'fitnessLevel',
  'lastTraining',
  'otherSports',
  'upcomingEvent',
  'upcomingEventDate',
  'upcomingEventOther',
  'planFailed',
  'planFailedReasons',
  'planFailedOther',
  'highTDEE',
  'inbodyScan',
  'inbodyData',
  'inbodyReportUrl',
  'inbodySource',
  'inbodyBodyMetricId',
  'progressPhotos',
  'photoFrontUrl',
  'photoSideUrl',
  'photoBackUrl',
  'photoFrontAnalysis',
  'photoSideAnalysis',
  'photoBackAnalysis',
];

const WORKOUT_FIELDS = [
  'injuries',
  'injuriesOther',
  'bodyFocus',
  'trainingDaysPerWeek',
  'workoutLocation',
  'gymLink',
  'workoutTime',
  'workoutDuration',
  'trainingObstacle',
  'trainingObstacleOther',
  'preferredSplit',
  'exercisesAvoid',
  'exercisesLove',
  'pushups',
  'squats',
  'pullups',
  'benchMax',
  'deadliftMax',
  'addCardio',
  'equipment',
  'strengthEquipment',
  'goal12WeekPace',
  'restDaysPreference',
  'fixedRestDays',
  'liftExperience',
];

const NUTRITION_FIELDS = [
  'foodAllergies',
  'foodAllergiesOther',
  'foodsExcluded',
  'foodsExcludedCustom',
  'dietType',
  'dietTypeOther',
  'diet',
  'mealPlanStyle',
  'mealsPerDay',
  'snacksPerDay',
  'targetWeight',
  'proteinPrefs',
  'proteinNotPrefs',
  'carbPrefs',
  'carbNotPrefs',
  'fatPrefs',
  'fatNotPrefs',
  'fruitPrefs',
  'fruitNotPrefs',
  'dairyPrefs',
  'dairyNotPrefs',
  'water',
  'eatingHabits',
  'weekendEating',
  'supplementsBudget',
  'foodBudget',
  'eatingOutFrequency',
  'preferSimpleMeals',
  'mealPrepTime',
  'cookOrReady',
  'religiousDiet',
  'seasonalNutritionMode',
];

const HEALTH_FIELDS = [
  'medicalHistory',
  'medications',
  'pastInjuriesHistory',
  'doctorClearance',
  'sleep',
  'recoveryFeel',
  'stressLevel',
  'energyLevel',
  'dailyRoutine',
  'progressTracking',
  'hungerScale',
  'motivationStart',
  'stressCoping',
  'exerciseAttitude',
  'feelings',
  'bodyFat',
  'physique',
  'targetPhysique',
  'successMetrics',
  'trackProgress',
  'motivation',
  'confidence',
];

const FEMALE_HEALTH_FIELDS = [
  'cycleRegularity',
  'cycleSymptoms',
  'pregnancyStatus',
  'postpartumStatus',
  'breastfeeding',
  'femaleHealthConditions',
  'birthControl',
  'menopause',
  'cycleLength',
];

const BODY_TYPE_LABELS = {
  ectomorph: { en: 'Ectomorph (lean, hard to gain)', ar: 'نحيف (إكتومورف)' },
  mesomorph: { en: 'Mesomorph (athletic build)', ar: 'رياضي (ميزومورف)' },
  endomorph: { en: 'Endomorph (stores fat easily)', ar: 'يميل لتخزين الدهون (إندومورف)' },
};

const GOAL_DEADLINE_LABELS = {
  '1_month': { en: '1 month', ar: 'شهر' },
  '3_months': { en: '3 months', ar: '3 شهور' },
  '6_months': { en: '6 months', ar: '6 شهور' },
  '12_months': { en: '12 months', ar: '12 شهر' },
  no_deadline: { en: 'No deadline', ar: 'بدون موعد محدد' },
};

const UPCOMING_EVENT_LABELS = {
  vacation: { en: 'Vacation', ar: 'سفر / أجازة' },
  wedding: { en: 'Wedding', ar: 'فرح' },
  birthday: { en: 'Birthday', ar: 'عيد ميلاد' },
  other: { en: 'Other event', ar: 'مناسبة أخرى' },
  none: { en: 'None', ar: 'لا شيء' },
};

const PLAN_FAILED_REASON_LABELS = {
  no_time: { en: 'No time', ar: 'مفيش وقت' },
  inconsistent: { en: "Couldn't stay consistent", ar: 'مقدرتش ألتزم' },
  diet_restrictive: { en: 'Diet was too restrictive', ar: 'الدايت كان قاسي أوي' },
  no_results: { en: 'No results', ar: 'مفيش نتائج' },
  injury: { en: 'Injury', ar: 'إصابة' },
  lost_motivation: { en: 'Lost motivation', ar: 'فقدت الحماس' },
  other: { en: 'Other', ar: 'أخرى' },
};

const WATER_INTAKE_LABELS = {
  lt1_liter: { en: 'Less than 1 L/day (plain water)', ar: 'أقل من 1 لتر مية صافية' },
  '1_2_liters': { en: '1–2 L/day (plain water)', ar: '1–2 لتر مية صافية' },
  '2_3_liters': { en: '2–3 L/day (plain water)', ar: '2–3 لتر مية صافية' },
  gt3_liters: { en: 'More than 3 L/day (plain water)', ar: 'أكتر من 3 لتر مية صافية' },
  mostly_tea_coffee: {
    en: 'Mostly tea/coffee — HYDRATION: encourage plain water',
    ar: 'قهوة/شاي أكتر — ركّز على شرب مية صافية',
  },
  coffee: { en: 'Mostly tea/coffee (legacy)', ar: 'قهوة/شاي أكتر (قديم)' },
  lt2: { en: 'Fewer than 2 glasses (legacy)', ar: 'أقل من كوبين (قديم)' },
  '2-6': { en: '2–6 glasses (legacy)', ar: '2–6 أكواب (قديم)' },
  '7-10': { en: '7–10 glasses (legacy)', ar: '7–10 أكواب (قديم)' },
  gt10: { en: 'More than 10 glasses (legacy)', ar: 'أكتر من 10 (قديم)' },
};

const EATING_HABITS_LABELS = {
  emotional: {
    en: 'Emotional eating',
    adapt: 'Stress-aware meal timing; easy wins; no shame-based messaging',
  },
  bored: {
    en: 'Boredom eating',
    adapt: 'Structured snacks; volume foods; activity substitutes',
  },
  unconscious: {
    en: 'Unconscious eating',
    adapt: 'Mindful eating cues; pre-portioned meals; simple rules',
  },
  habitual: {
    en: 'Habitual eating',
    adapt: 'Anchor meals to routine; small repeatable templates',
  },
  energy: {
    en: 'Energy-driven eating',
    adapt: 'Balanced carbs around activity; steady meal timing',
  },
  late_night: {
    en: 'Late-night eating',
    adapt: 'Earlier last meal; protein-forward dinner; limit late carbs',
  },
  skips_breakfast: {
    en: 'Skips breakfast',
    adapt: 'Flexible first meal window; do not force IF if inconsistent',
  },
  large_portions: {
    en: 'Large portions',
    adapt: 'Plate guides; volume eating; half-plate vegetables',
  },
  frequent_snacking: {
    en: 'Frequent snacking',
    adapt: 'Planned snacks in macros; protein-forward snack list',
  },
};

const EATING_OUT_FREQUENCY_LABELS = {
  '0': {
    en: '0× per week eat-out/delivery',
    adapt: 'Home-cook baseline; batch prep friendly',
  },
  '1_2_week': {
    en: '1–2× per week eat-out/delivery',
    adapt: 'Plan 1–2 flexible meals; smart restaurant swaps',
  },
  '3_5_week': {
    en: '3–5× per week eat-out/delivery',
    adapt: 'Mix ready options + eating-out guides; limit fancy daily menus',
  },
  daily: {
    en: 'Daily eat-out/delivery',
    adapt: 'Ready-meal / delivery-first plan; macro-friendly picks; minimal prep',
  },
};

const WEEKEND_EATING_LABELS = {
  no: {
    en: 'Weekends same as weekdays',
    adapt: 'Single weekly template OK',
  },
  slightly: {
    en: 'Weekends slightly different',
    adapt: 'Light weekend flexibility; +5–10% calories Sat–Sun optional',
  },
  a_lot: {
    en: 'Weekends very different',
    adapt: 'Separate weekend plan; structured treats; Mon reset; avoid guilt spiral',
  },
};

const PREFER_SIMPLE_MEALS_LABELS = {
  yes: {
    en: 'Prefers simple meals',
    adapt: '≤5 ingredients; one-pan; repeat staples; short recipes only',
  },
  no: {
    en: 'OK with complex meals',
    adapt: 'Can include varied recipes if prep time allows',
  },
};

const TRAINING_OBSTACLE_LABELS = {
  no_time: {
    en: 'No time',
    ar: 'مفيش وقت',
    adapt: 'Prefer 3-day plans; short sessions (20–35 min); stack on weekends if needed',
  },
  low_motivation: {
    en: 'Low motivation',
    ar: 'حماس قليل',
    adapt: 'Shorter wins; favorite exercises; flexible skip without guilt; light check-ins',
  },
  work_schedule: {
    en: 'Work schedule',
    ar: 'دوام الشغل',
    adapt: 'Flexible AM/PM slots; alternate-day templates; quick home backup sessions',
  },
  travel: {
    en: 'Travel',
    ar: 'سفر',
    adapt: 'Portable/hotel workouts; minimal equipment; bodyweight circuits',
  },
  recovery: {
    en: 'Recovery',
    ar: 'تعافي',
    adapt: 'Lower volume; extra rest days; deload weeks; avoid back-to-back hard days',
  },
  pain: {
    en: 'Pain',
    ar: 'ألم',
    adapt: 'Pain-free ROM; regressions; avoid aggravating patterns; medical clearance if needed',
  },
  family: {
    en: 'Family responsibilities',
    ar: 'مسؤوليات عيلة',
    adapt: 'Short home sessions; early AM; weekend anchor days; tag-team with partner',
  },
  other: { en: 'Other', ar: 'أخرى', adapt: null },
};

const RECOVERY_FEEL_LABELS = {
  fast: { en: 'Fast recovery', adapt: 'Can handle higher weekly volume; standard rest spacing OK' },
  normal: { en: 'Normal recovery', adapt: 'Balanced volume; 1 rest day per 3–4 training days' },
  slow: { en: 'Slow recovery', adapt: 'Lower volume; extra rest days; avoid back-to-back hard sessions' },
  sore_days: {
    en: 'Sore for days after training',
    adapt: 'Low volume; longer rest; prioritize recovery modalities; regress intensity',
  },
  not_sure: { en: 'Not sure', adapt: 'Start conservative volume; monitor soreness week 1–2' },
};

const DAILY_ROUTINE_LABELS = {
  desk_job: { en: 'Desk job', adapt: 'Low NEAT — schedule movement breaks; walking targets' },
  standing_job: { en: 'Standing job', adapt: 'Moderate NEAT — account for leg fatigue in training' },
  physical_job: { en: 'Physical job', adapt: 'High NEAT — reduce gym volume; recovery priority' },
  student: { en: 'Student', adapt: 'Variable schedule — flexible session slots; shorter workouts' },
  variable_schedule: { en: 'Variable schedule', adapt: 'Flexible plan; anchor 2–3 fixed training windows' },
};

const WEEKDAY_LABELS = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

function daysUntilDate(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return null;
  const target = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diff = Math.round((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  return diff >= 0 ? diff : null;
}

function weightTrendLabel(currentKg, pastKg) {
  const current = Number(currentKg);
  const past = Number(pastKg);
  if (!Number.isFinite(current) || !Number.isFinite(past)) return null;
  const delta = current - past;
  if (Math.abs(delta) < 1) return { en: 'Stable', ar: 'ثابت' };
  if (delta > 0) return { en: 'Gaining', ar: 'بتزيد' };
  return { en: 'Losing', ar: 'بتنقص' };
}

function arr(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function isEmptyValue(v) {
  if (v == null || v === '') return true;
  if (Array.isArray(v)) return v.length === 0 || v.every((x) => x == null || x === '' || x === 'none');
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

function formatScalar(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v.trim() || null;
  return null;
}

function formatArray(v) {
  const items = arr(v).filter((x) => x !== 'none');
  if (!items.length) return null;
  return items
    .map((item) => {
      if (typeof item === 'object' && item !== null) {
        return item.name || item.label || item.value || JSON.stringify(item);
      }
      return String(item);
    })
    .join(', ');
}

function formatInbodyDataForCoach(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw;
  const parts = [];
  const num = (k, label, suffix = '') => {
    if (o[k] != null && o[k] !== '') parts.push(`${label}: ${o[k]}${suffix}`);
  };
  num('bodyFatPercent', 'bodyFatPct', '%');
  num('skeletalMuscleMassKg', 'SMM', ' kg');
  num('bodyFatMassKg', 'bodyFatMass', ' kg');
  num('bmi', 'BMI');
  num('basalMetabolicRate', 'BMR', ' kcal');
  num('visceralFatLevel', 'visceralFat');
  num('waistHipRatio', 'WHR');
  num('inbodyScore', 'inbodyScore');
  num('targetWeightKg', 'targetWeight', ' kg');
  num('totalBodyWaterL', 'TBW', ' L');
  if (o.testDate) parts.push(`testDate: ${o.testDate}`);
  if (o.segmentalLean) parts.push('segmentalLean: present');
  if (o.segmentalFat) parts.push('segmentalFat: present');
  return parts.length ? parts.join('; ') : null;
}

function formatFieldValue(key, raw, data = null) {
  if (isEmptyValue(raw)) return null;
  if (key === 'inbodyData') return formatInbodyDataForCoach(raw);
  if (key === 'bodyType') {
    const k = String(raw).toLowerCase();
    const labels = BODY_TYPE_LABELS[k];
    return labels ? `${k} — ${labels.en}` : String(raw);
  }
  if (key === 'goalDeadline') {
    const labels = GOAL_DEADLINE_LABELS[String(raw)];
    return labels ? labels.en : String(raw);
  }
  if (key === 'upcomingEvent') {
    const k = String(raw);
    if (k === 'none') return UPCOMING_EVENT_LABELS.none.en;
    const labels = UPCOMING_EVENT_LABELS[k];
    const base =
      k === 'other' && data?.upcomingEventOther
        ? String(data.upcomingEventOther)
        : labels
          ? labels.en
          : k;
    const days = data?.upcomingEventDate ? daysUntilDate(String(data.upcomingEventDate)) : null;
    if (days != null && data?.upcomingEventDate) {
      return `${base} — in ${days} days (${data.upcomingEventDate})`;
    }
    return base;
  }
  if (key === 'planFailed') {
    if (String(raw) === 'no') return 'No';
    if (String(raw) === 'yes') {
      const reasons = arr(data?.planFailedReasons)
        .map((r) => PLAN_FAILED_REASON_LABELS[r]?.en ?? r)
        .filter(Boolean);
      const other = data?.planFailedOther ? String(data.planFailedOther).trim() : '';
      if (reasons.includes('Other') && other) {
        return `Yes — ${reasons.map((r) => (r === 'Other' ? other : r)).join(', ')}`;
      }
      return reasons.length ? `Yes — ${reasons.join(', ')}` : 'Yes';
    }
    return String(raw);
  }
  if (key === 'planFailedReasons') return null;
  if (key === 'planFailedOther') return null;
  if (key === 'trainingObstacle') {
    const list = arr(raw);
    if (!list.length) return null;
    const parts = list.map((k) => {
      const labels = TRAINING_OBSTACLE_LABELS[k];
      const base =
        k === 'other' && data?.trainingObstacleOther
          ? String(data.trainingObstacleOther).trim()
          : labels
            ? labels.en
            : k;
      const adapt = labels?.adapt;
      return adapt ? `${base} — ADAPT: ${adapt}` : base;
    });
    return parts.join('; ');
  }
  if (key === 'trainingObstacleOther') return null;
  if (key === 'fixedRestDays') return null;
  if (key === 'restDaysPreference') {
    const k = String(raw);
    if (k === 'fixed') {
      const days = arr(data?.fixedRestDays).map((d) => WEEKDAY_LABELS[d] ?? d);
      return days.length ? `Fixed — rest on ${days.join(', ')}` : 'Fixed rest days';
    }
    if (k === 'coach') return 'Coach decides';
    if (k === 'minimal') return 'As few rest days as possible';
    return k;
  }
  if (key === 'injuries') {
    const list = arr(raw).filter((i) => i !== 'none');
    if (!list.length) return 'none — no exercise safety filters';
    const safety = buildExerciseSafetyFilters(data || {});
    const parts = list.map((i) => (i === 'other' && data?.injuriesOther ? data.injuriesOther : i));
    const base = parts.join(', ');
    if (safety.active) {
      const examples = Object.entries(safety.blockedExamples)
        .map(([inj, exs]) => `${inj}: block ${exs.slice(0, 3).join(', ')}`)
        .join('; ');
      return examples ? `${base} — SAFETY: ${examples}` : base;
    }
    return base;
  }
  if (key === 'injuriesOther') return null;
  if (key === 'foodAllergies') {
    const list = arr(raw).filter((a) => a !== 'none');
    if (!list.length) return 'none';
    const otherDetail =
      typeof data?.foodAllergiesOther === 'string' ? data.foodAllergiesOther.trim() : '';
    return list
      .map((a) => (a === 'other' && otherDetail ? otherDetail : a))
      .join(', ');
  }
  if (key === 'foodAllergiesOther') return null;
  if (key === 'dietType') {
    const k = String(raw);
    if (k === 'other' && data?.dietTypeOther) return String(data.dietTypeOther).trim();
    return k;
  }
  if (key === 'dietTypeOther') return null;
  if (key === 'water') {
    const labels = WATER_INTAKE_LABELS[String(raw)];
    return labels ? labels.en : String(raw);
  }
  if (key === 'eatingHabits') {
    const list = arr(raw);
    if (!list.length) return null;
    return list
      .map((k) => {
        const labels = EATING_HABITS_LABELS[k];
        if (!labels) return k;
        return labels.adapt ? `${labels.en} — ADAPT: ${labels.adapt}` : labels.en;
      })
      .join('; ');
  }
  if (key === 'eatingOutFrequency') {
    const labels = EATING_OUT_FREQUENCY_LABELS[String(raw)];
    if (!labels) return String(raw);
    return labels.adapt ? `${labels.en} — ADAPT: ${labels.adapt}` : labels.en;
  }
  if (key === 'weekendEating') {
    const labels = WEEKEND_EATING_LABELS[String(raw)];
    if (!labels) return String(raw);
    return labels.adapt ? `${labels.en} — ADAPT: ${labels.adapt}` : labels.en;
  }
  if (key === 'preferSimpleMeals') {
    const labels = PREFER_SIMPLE_MEALS_LABELS[String(raw)];
    if (!labels) return String(raw);
    return labels.adapt ? `${labels.en} — ADAPT: ${labels.adapt}` : labels.en;
  }
  if (key === 'highTDEE') {
    return raw === true ? 'true (very active daily life — boost TDEE)' : null;
  }
  if (key === 'otherSports') {
    const sports = formatArray(raw);
    if (!sports) return null;
    if (arr(raw).includes('football')) {
      return `${sports} — avoid heavy leg day before football/match days`;
    }
    return sports;
  }
  if (key === 'weightHistory') {
    const kg = formatScalar(raw);
    if (!kg) return null;
    const trend = data && weightTrendLabel(data.weight, raw);
    return trend ? `${kg} kg — trend: ${trend.en}` : `${kg} kg`;
  }
  if (key === 'bodyMeasurements' && typeof raw === 'object' && raw !== null) {
    const parts = Object.entries(raw)
      .map(([k, val]) => (val != null && val !== '' ? `${k}: ${val}` : null))
      .filter(Boolean);
    return parts.length ? parts.join('; ') : null;
  }
  if (key === 'recoveryFeel') {
    const labels = RECOVERY_FEEL_LABELS[String(raw)];
    if (!labels) return String(raw);
    return labels.adapt ? `${labels.en} — ADAPT: ${labels.adapt}` : labels.en;
  }
  if (key === 'dailyRoutine') {
    const labels = DAILY_ROUTINE_LABELS[String(raw)];
    if (!labels) return String(raw);
    return labels.adapt ? `${labels.en} — ADAPT: ${labels.adapt}` : labels.en;
  }
  if (key === 'stressLevel' || key === 'energyLevel' || key === 'hungerScale') {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1 && n <= 10) return `${n}/10`;
    return formatScalar(raw);
  }
  if (Array.isArray(raw)) return formatArray(raw);
  if (typeof raw === 'object') {
    try {
      const s = JSON.stringify(raw);
      return s.length <= 200 ? s : `${s.slice(0, 197)}…`;
    } catch {
      return null;
    }
  }
  return formatScalar(raw);
}

function pickSection(data, fields) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  for (const key of fields) {
    if (!(key in data)) continue;
    const formatted = formatFieldValue(key, data[key], data);
    if (formatted != null) out[key] = formatted;
  }
  return out;
}

function buildFlatLegacy(data, sections) {
  const o = data && typeof data === 'object' ? data : {};
  const injuries = arr(o.injuries).filter((i) => i !== 'none');
  const foodAllergies = arr(o.foodAllergies).filter(Boolean);
  const diet = arr(o.diet);
  if (o.dietType && !diet.includes(o.dietType)) diet.push(String(o.dietType));

  return {
    primaryGoal: o.primaryGoal != null ? String(o.primaryGoal) : sections.core.primaryGoal ?? null,
    bodyType: sections.core.bodyType ?? (o.bodyType != null ? String(o.bodyType) : null),
    diet,
    eatingHabits: sections.nutrition.eatingHabits ?? formatArray(o.eatingHabits),
    injuries,
    foodAllergies,
    foodsExcluded: arr(o.foodsExcluded),
    foodsExcludedCustom: o.foodsExcludedCustom != null ? String(o.foodsExcludedCustom) : null,
    workoutLocation: sections.workout.workoutLocation ?? (o.workoutLocation != null ? String(o.workoutLocation) : null),
    activityLevel: sections.core.activityLevel ?? (o.activityLevel != null ? String(o.activityLevel) : null),
    targetPhysique: sections.core.targetPhysique ?? sections.health.targetPhysique ?? null,
    fitnessLevel: sections.core.fitnessLevel ?? (o.fitnessLevel != null ? String(o.fitnessLevel) : null),
    religiousDiet: sections.nutrition.religiousDiet ?? (o.religiousDiet != null ? String(o.religiousDiet) : null),
    foodBudget: sections.nutrition.foodBudget ?? null,
    dietType: sections.nutrition.dietType ?? null,
    trainingDaysPerWeek: sections.workout.trainingDaysPerWeek ?? null,
    trainingObstacle: sections.workout.trainingObstacle ?? null,
    preferredSplit: sections.workout.preferredSplit ?? null,
    exercisesAvoid: arr(o.exercisesAvoid),
    exercisesLove: arr(o.exercisesLove),
    medicalHistory: sections.health.medicalHistory ?? null,
    medications: sections.health.medications ?? null,
    sleep: sections.health.sleep ?? null,
    gender: o.gender != null ? String(o.gender) : sections.core.gender ?? null,
    needsFemaleWellness: o.needsFemaleWellness === true,
    cycleRegularity:
      sections.femaleHealth?.cycleRegularity ??
      (o.cycleRegularity != null ? String(o.cycleRegularity) : null),
    cycleSymptoms: arr(o.cycleSymptoms),
    pregnancyStatus: o.pregnancyStatus != null ? String(o.pregnancyStatus) : null,
    postpartumStatus: o.postpartumStatus != null ? String(o.postpartumStatus) : null,
    breastfeeding: o.breastfeeding != null ? String(o.breastfeeding) : null,
    femaleHealthConditions: arr(o.femaleHealthConditions),
    birthControl: o.birthControl != null ? String(o.birthControl) : null,
    menopause: o.menopause != null ? String(o.menopause) : null,
    cycleLength: o.cycleLength != null ? String(o.cycleLength) : null,
  };
}

/**
 * @param {object|null|undefined} onboardingData
 * @returns {{
 *   core: Record<string, string>,
 *   workout: Record<string, string>,
 *   nutrition: Record<string, string>,
 *   health: Record<string, string>,
 *   flat: object,
 * }}
 */
function extractOnboardingForCoach(onboardingData) {
  const data = onboardingData && typeof onboardingData === 'object' ? onboardingData : {};
  const core = pickSection(data, CORE_FIELDS);
  const workout = pickSection(data, WORKOUT_FIELDS);
  const nutrition = pickSection(data, NUTRITION_FIELDS);
  const health = pickSection(data, HEALTH_FIELDS);
  const femaleHealth = pickSection(data, FEMALE_HEALTH_FIELDS);
  const flat = buildFlatLegacy(data, { core, workout, nutrition, health, femaleHealth });

  return { core, workout, nutrition, health, femaleHealth, flat };
}

function formatSectionLines(section, title) {
  const keys = Object.keys(section);
  if (!keys.length) return [];
  const lines = [`--- ${title} ---`];
  for (const key of keys) {
    lines.push(`${key}: ${section[key]}`);
  }
  return lines;
}

/**
 * @param {ReturnType<typeof extractOnboardingForCoach>} extracted
 */
function formatOnboardingForPrompt(extracted) {
  if (!extracted) return '';
  const parts = [
    ...formatSectionLines(extracted.core, 'ONBOARDING — CORE'),
    ...formatSectionLines(extracted.workout, 'ONBOARDING — WORKOUT'),
    ...formatSectionLines(extracted.nutrition, 'ONBOARDING — NUTRITION'),
    ...formatSectionLines(extracted.health, 'ONBOARDING — HEALTH'),
    ...formatSectionLines(extracted.femaleHealth || {}, 'ONBOARDING — FEMALE HEALTH (optional)'),
  ];
  const adaptNotes = buildWorkoutAdaptationNotes(extracted.flat || {});
  if (adaptNotes.length) {
    parts.push('--- WORKOUT ADAPTATION ---');
    adaptNotes.forEach((n) => parts.push(n));
  }
  const nutritionNotes = buildNutritionAdaptationNotes(extracted.flat || {});
  if (nutritionNotes.length) {
    parts.push('--- NUTRITION ADAPTATION ---');
    nutritionNotes.forEach((n) => parts.push(n));
  }
  const femaleNotes = buildFemaleHealthAdaptationNotes(extracted.flat || {});
  if (femaleNotes.length) {
    parts.push('--- FEMALE HEALTH ADAPTATION ---');
    femaleNotes.forEach((n) => parts.push(n));
  }
  return parts.length ? parts.join('\n') : '';
}

function bodyTypeLabel(bodyType, locale = 'ar') {
  const k = String(bodyType || '').toLowerCase();
  const labels = BODY_TYPE_LABELS[k];
  if (!labels) return bodyType ? String(bodyType) : null;
  return locale === 'en' ? labels.en : labels.ar;
}

module.exports = {
  CORE_FIELDS,
  WORKOUT_FIELDS,
  NUTRITION_FIELDS,
  HEALTH_FIELDS,
  FEMALE_HEALTH_FIELDS,
  extractOnboardingForCoach,
  formatOnboardingForPrompt,
  bodyTypeLabel,
  formatFieldValue,
};
