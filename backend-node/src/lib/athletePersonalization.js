/**
 * Derive athlete home-dashboard personalization from profile + onboarding answers.
 */
const { estimateTargets: baseEstimateTargets } = require('./nutritionTargets');

const TRAINING_DAY_PATTERNS = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 6],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
};

const SPLIT_EXERCISES = {
  push: [
    { name: 'Bench Press', sets: 4, reps: 10 },
    { name: 'Overhead Press', sets: 3, reps: 10 },
    { name: 'Incline Dumbbell Press', sets: 3, reps: 12 },
  ],
  pull: [
    { name: 'Lat Pulldown', sets: 4, reps: 12 },
    { name: 'Barbell Row', sets: 4, reps: 10 },
    { name: 'Face Pull', sets: 3, reps: 15 },
  ],
  legs: [
    { name: 'Back Squat', sets: 4, reps: 8 },
    { name: 'Romanian Deadlift', sets: 3, reps: 10 },
    { name: 'Walking Lunges', sets: 3, reps: 12 },
  ],
  upper: [
    { name: 'Bench Press', sets: 4, reps: 10 },
    { name: 'Barbell Row', sets: 4, reps: 10 },
    { name: 'Lateral Raise', sets: 3, reps: 15 },
  ],
  lower: [
    { name: 'Squats', sets: 4, reps: 10 },
    { name: 'Leg Press', sets: 3, reps: 12 },
    { name: 'Leg Curl', sets: 3, reps: 12 },
  ],
  full: [
    { name: 'Squats', sets: 4, reps: 10 },
    { name: 'Bench Press', sets: 4, reps: 10 },
    { name: 'Romanian Deadlift', sets: 3, reps: 8 },
  ],
  cardio: [
    { name: 'Treadmill / Cardio', sets: 1, reps: 20, detail: '20 min' },
    { name: 'Bike Intervals', sets: 5, reps: 2, detail: '2 min' },
    { name: 'Core Circuit', sets: 3, reps: 12 },
  ],
};

function str(v) {
  if (v === undefined || v === null || v === '') return null;
  return String(v);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function arr(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v) return [v];
  return [];
}

function humanize(value) {
  if (!value) return null;
  return String(value)
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const ONBOARDING_AR = {
  'Build Muscle': 'تبني عضل',
  'Lose Weight': 'أخسّ',
  'Improve Endurance': 'تطلع السلم براحتك',
  'Stay Healthy': 'فورمة ساحل',
  Beginner: 'مبتدئ',
  Intermediate: 'في النص',
  Advanced: 'متقدّم',
  full_body: 'جسم كامل',
  upper_lower: 'علوي / سفلي',
  ppl: 'Push / Pull / Legs',
  bro: 'Bro split',
  coach: 'الكوتش يقرر',
  sedentary: 'قاعد معظم اليوم',
  light: 'خفيف',
  moderate: 'متوسط',
  active: 'نشيط',
  very_active: 'نشيط جداً',
  home: 'البيت',
  gym: 'الجيم',
  both: 'البيت والجيم',
  morning: 'الصبح',
  afternoon: 'الظهر',
  evening: 'بالليل',
  flexible: 'مرن',
};

const EXERCISE_AR = {
  'Bench Press': 'ضغط البنش',
  'Overhead Press': 'ضغط كتف',
  'Incline Dumbbell Press': 'ضغط دамбل مائل',
  'Lat Pulldown': 'سحب علوي',
  'Barbell Row': 'تجديف بار',
  'Face Pull': 'سحب وجه',
  'Back Squat': 'قرفصاء خلفي',
  Squats: 'قرفصاء',
  'Romanian Deadlift': 'رفعة رومانية',
  'Walking Lunges': 'اندفاعات',
  'Lateral Raise': 'رفع جانبي',
  'Leg Press': 'ضغط رجل',
  'Leg Curl': 'ثني رجل',
  Deadlifts: 'رفعة ميتة',
  'Treadmill / Cardio': 'مشي / كارديو',
  'Bike Intervals': 'دراجة فواصل',
  'Core Circuit': 'دائرة بطن',
};

function localizeValue(value, locale) {
  if (!value) return null;
  const raw = String(value);
  if (locale !== 'ar') return humanize(raw);
  if (ONBOARDING_AR[raw]) return ONBOARDING_AR[raw];
  const key = raw.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');
  for (const [k, v] of Object.entries(ONBOARDING_AR)) {
    if (k.toLowerCase().replace(/_/g, ' ') === key) return v;
    if (humanize(k)?.toLowerCase() === key) return v;
  }
  return humanize(raw);
}

function localizeExercise(ex, locale) {
  if (locale !== 'ar') return ex;
  const nameAr = EXERCISE_AR[ex.name] || ex.name;
  return { ...ex, nameAr, displayName: nameAr };
}

function parseTrainingDays(raw) {
  if (raw === undefined || raw === null || raw === '') return 4;
  const s = String(raw).toLowerCase();
  const m = s.match(/(\d+)/);
  if (m) return Math.min(6, Math.max(2, Number(m[1])));
  if (s.includes('6')) return 6;
  if (s.includes('5')) return 5;
  if (s.includes('4')) return 4;
  if (s.includes('3')) return 3;
  if (s.includes('2')) return 2;
  return 4;
}

function trainingDayIndexes(daysPerWeek) {
  return TRAINING_DAY_PATTERNS[daysPerWeek] || TRAINING_DAY_PATTERNS[4];
}

function waterTargetMl(onboardingData) {
  const map = { coffee: 1500, lt2: 2000, '2-6': 2500, '7-10': 3000, gt10: 3500 };
  const key = onboardingData?.water;
  return map[key] ?? 2500;
}

function splitKey(preferredSplit, fitnessGoal) {
  const split = String(preferredSplit || '').toLowerCase();
  const goal = String(fitnessGoal || '').toLowerCase();
  if (split.includes('push')) return 'push';
  if (split.includes('pull')) return 'pull';
  if (split.includes('leg') || split.includes('lower')) return 'legs';
  if (split.includes('upper')) return 'upper';
  if (split.includes('full')) return 'full';
  if (goal.includes('lose') || goal.includes('fat') || goal.includes('cardio')) return 'cardio';
  return 'full';
}

function defaultWorkoutExercises(fitnessGoal, onboardingData = {}, locale = 'ar') {
  const key = splitKey(onboardingData.preferredSplit, fitnessGoal);
  const base = SPLIT_EXERCISES[key] || SPLIT_EXERCISES.full;
  const loved = arr(onboardingData.exercisesLove).slice(0, 2);
  let list = base;
  if (loved.length) {
    const custom = loved.map((name) => ({ name, sets: 3, reps: 10 }));
    list = [...custom, ...base].slice(0, 5);
  }
  return locale === 'ar' ? list.map((ex) => localizeExercise(ex, locale)) : list;
}

function estimateTargets(profile) {
  const od = profile?.onboardingData && typeof profile.onboardingData === 'object' ? profile.onboardingData : {};
  const base = baseEstimateTargets(profile);
  const customCal = num(od.calorieTarget);
  if (customCal) {
    const proteinTarget =
      num(od.proteinTarget) ||
      (String(od.dietType || '').toLowerCase().includes('high') && profile?.weight
        ? Math.round(profile.weight * 2.2)
        : base.proteinTarget);
    const proteinCals = proteinTarget * 4;
    const remaining = Math.max(0, customCal - proteinCals);
    return {
      calorieTarget: Math.round(customCal),
      proteinTarget: Math.round(proteinTarget),
      carbTarget: Math.round((remaining * 0.45) / 4),
      fatTarget: Math.round((remaining * 0.25) / 9),
    };
  }
  const meals = parseTrainingDays(od.mealsPerDay);
  if (meals >= 5) {
    return { ...base, proteinTarget: Math.round(base.proteinTarget * 1.05) };
  }
  return base;
}

function buildWeekPlan(weekly, onboardingData, todayKey, locale = 'ar') {
  const daysPerWeek = parseTrainingDays(onboardingData?.trainingDaysPerWeek);
  const trainIdx = new Set(trainingDayIndexes(daysPerWeek));
  const split =
    localizeValue(onboardingData?.preferredSplit, locale) ||
    (locale === 'ar' ? 'تدريب' : 'Training');

  return weekly.map((d) => {
    const dow = new Date(`${d.date}T12:00:00Z`).getUTCDay();
    const isTrainingDay = trainIdx.has(dow);
    let status = 'planned';
    if (!isTrainingDay) status = 'rest';
    else if (d.workouts > 0) status = 'done';
    else if (d.date === todayKey) status = 'today';
    return {
      day: d.day,
      date: d.date,
      status,
      isTrainingDay,
      splitLabel: isTrainingDay ? split : null,
    };
  });
}

function buildCoachTip({ profile, today, targets, streak, totals, personalization, locale = 'ar' }) {
  const isAr = locale === 'ar';
  const goal = personalization?.goal || profile?.fitnessGoal;
  const sleep = personalization?.sleepLabel;
  const injuries = personalization?.injuries || [];
  const split = personalization?.preferredSplit || (isAr ? 'برنامجك' : 'your split');
  const plannedDays = personalization?.trainingDaysPerWeek || 4;
  const dietType = personalization?.dietType || (isAr ? 'نظامك الغذائي' : 'your diet plan');
  const goalFallback = isAr ? 'هدفك' : 'your goal';

  if (injuries.length && !today.workouts.length) {
    const areas = injuries.slice(0, 2).join(isAr ? '، ' : ', ');
    return isAr
      ? `تمرّن بحذر حول ${areas} — ${split} مجدول عندما تكون جاهزاً.`
      : `Train smart around ${areas} — ${split} is scheduled when you are ready.`;
  }
  if (sleep && String(sleep).includes('5') && !today.workouts.length) {
    return isAr
      ? `نومك ${sleep} — ركّز على الاستشفاء؛ جلسة خفيفة أو حركة مرونة تُحسب اليوم.`
      : `Sleep is ${sleep} — prioritize recovery; a lighter session or mobility work still counts today.`;
  }
  if (!today.nutrition.logCount && !today.workouts.length) {
    return goal
      ? isAr
        ? `خطتك تستهدف "${goal}" — سجّل وجبة أو أكمل ${plannedDays} أيام تدريب هذا الأسبوع.`
        : `Your plan targets "${goal}" — log a meal or complete ${plannedDays} training days this week.`
      : isAr
        ? 'سجّل أول وجبة أو تمرين اليوم لفتح رؤى مخصصة.'
        : 'Log your first meal or workout today to unlock personalized insights.';
  }
  if (today.nutrition.protein < targets.proteinTarget * 0.5) {
    return isAr
      ? `البروتين ${Math.round(today.nutrition.protein)}جم — استهدف ${targets.proteinTarget}جم (${dietType}).`
      : `Protein is ${Math.round(today.nutrition.protein)}g — aim for ${targets.proteinTarget}g (${dietType}).`;
  }
  if (streak >= 3) {
    return isAr
      ? `سلسلة ${streak} أيام تمرين! التالي: ${split} كما هو مخطّط.`
      : `You're on a ${streak}-day workout streak. Next up: ${split} as planned.`;
  }
  const workoutDays = totals.workouts;
  if (workoutDays < Math.max(1, plannedDays - 1)) {
    return isAr
      ? `${workoutDays}/${plannedDays} أيام تدريب هذا الأسبوع — التزم بـ${split}.`
      : `${workoutDays}/${plannedDays} training days logged this week — stay on your ${split}.`;
  }
  return isAr
    ? `تقدّم رائع نحو "${goal || goalFallback}": ${totals.workouts} تمارين، ${Math.round(today.nutrition.calories)}/${targets.calorieTarget} سعرة اليوم.`
    : `Great progress toward "${goal || goalFallback}": ${totals.workouts} workouts, ${Math.round(today.nutrition.calories)}/${targets.calorieTarget} kcal today.`;
}

function buildAiRecommendations({ profile, today, targets, totals, weekly, personalization }) {
  const recs = [];
  const goal = String(personalization?.goal || profile?.fitnessGoal || '').toLowerCase();
  const proteinTarget = Math.round(targets.proteinTarget);
  const proteinToday = Math.round(today.nutrition.protein);
  const plannedDays = personalization?.trainingDaysPerWeek || 4;

  if (proteinToday < proteinTarget * 0.75) {
    recs.push({ key: 'protein', params: { target: String(proteinTarget) } });
  }

  const workoutDays = weekly.filter((d) => d.workouts > 0).length;
  if (workoutDays < plannedDays) {
    recs.push({ key: 'cardio' });
  }

  const calorieGap = targets.calorieTarget - today.nutrition.calories;
  if (goal.includes('muscle') || goal.includes('gain')) {
    if (calorieGap > 200) recs.push({ key: 'caloriesUp' });
  } else if (goal.includes('lose') || goal.includes('fat')) {
    if (today.nutrition.calories > targets.calorieTarget * 1.08) recs.push({ key: 'caloriesDown' });
  } else if (calorieGap > 250) {
    recs.push({ key: 'caloriesUp' });
  }

  if (personalization?.sleepLabel && String(personalization.sleepLabel).includes('5')) {
    recs.push({
      key: 'sleepRecovery',
      params: { goal: personalization.goalLabel || personalization.goal || 'your fitness' },
    });
  }
  if (personalization?.injuries?.length) {
    recs.push({ key: 'trainSafe', params: { area: personalization.injuries[0] } });
  }

  if (recs.length < 3 && totals.workouts < plannedDays) recs.push({ key: 'training' });
  if (recs.length < 3 && today.nutrition.logCount === 0) recs.push({ key: 'logMeals' });
  if (recs.length < 3 && today.workouts.length === 0) recs.push({ key: 'todayWorkout' });

  return recs.slice(0, 3);
}

function buildAthletePersonalization(profile, locale = 'ar') {
  const isAr = locale === 'ar';
  const od =
    profile?.onboardingData && typeof profile.onboardingData === 'object' ? profile.onboardingData : {};

  const goal = str(profile?.fitnessGoal) || str(od.primaryGoal) || str(od.goal12Week);
  const trainingDaysPerWeek = parseTrainingDays(od.trainingDaysPerWeek);
  const injuries = arr(od.injuries).filter((i) => i !== 'none');
  const bodyFocus = arr(od.bodyFocus);

  const chips = [];
  if (goal) chips.push({ icon: 'flag', label: localizeValue(goal, locale) });
  if (trainingDaysPerWeek) {
    chips.push({
      icon: 'calendar_month',
      label: isAr
        ? `${trainingDaysPerWeek} أيام / أسبوع`
        : `${trainingDaysPerWeek} days / week`,
    });
  }
  if (od.preferredSplit) chips.push({ icon: 'fitness_center', label: localizeValue(od.preferredSplit, locale) });
  if (od.dietType) chips.push({ icon: 'restaurant', label: localizeValue(od.dietType, locale) });
  if (od.sleep) {
    chips.push({
      icon: 'bedtime',
      label: isAr ? `نوم: ${localizeValue(od.sleep, locale)}` : `Sleep: ${humanize(od.sleep)}`,
    });
  }
  if (od.workoutLocation) chips.push({ icon: 'location_on', label: localizeValue(od.workoutLocation, locale) });

  const durationMap = { '30': 30, '45': 45, '60': 60, '75': 75, '90': 90 };
  const durationKey = str(od.workoutDuration);
  let durationMin = 45;
  if (durationKey) {
    const dm = durationKey.match(/(\d+)/);
    if (dm) durationMin = Number(dm[1]);
    else if (durationMap[durationKey]) durationMin = durationMap[durationKey];
  }

  return {
    goal,
    goalLabel: localizeValue(goal, locale),
    trainingDaysPerWeek,
    preferredSplit: localizeValue(od.preferredSplit, locale),
    preferredSplitRaw: str(od.preferredSplit),
    workoutDurationMin: durationMin,
    workoutLocation: localizeValue(od.workoutLocation, locale),
    workoutTime: localizeValue(od.workoutTime, locale),
    dietType: localizeValue(od.dietType, locale),
    mealsPerDay: localizeValue(od.mealsPerDay, locale),
    sleep: str(od.sleep),
    sleepLabel: localizeValue(od.sleep, locale),
    waterTargetMl: waterTargetMl(od),
    injuries,
    bodyFocus,
    fitnessLevel: localizeValue(profile?.fitnessLevel || od.fitnessLevel, locale),
    targetWeight: num(od.targetWeight),
    chips: chips.slice(0, 6),
    planTitle: goal
      ? `${localizeValue(od.preferredSplit, locale) || (isAr ? 'تدريب' : 'Training')} · ${localizeValue(goal, locale)}`
      : isAr
        ? 'جلسة تدريب'
        : 'Training session',
  };
}

module.exports = {
  buildAthletePersonalization,
  buildWeekPlan,
  buildCoachTip,
  buildAiRecommendations,
  defaultWorkoutExercises,
  estimateTargets,
  waterTargetMl,
  localizeValue,
};
