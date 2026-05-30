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

function parseMealsPerDay(raw) {
  if (raw === undefined || raw === null || raw === '') return 4;
  const m = String(raw).match(/(\d+)/);
  if (m) return Math.min(6, Math.max(3, Number(m[1])));
  return 4;
}

const DEFAULT_FOOD_POOLS = {
  en: {
    protein: ['Grilled chicken', 'Eggs', 'Greek yogurt'],
    carb: ['Rice', 'Oats', 'Whole wheat bread'],
    fat: ['Olive oil', 'Almonds'],
    fruit: ['Banana', 'Apple', 'Dates'],
    dairy: ['Yogurt', 'Milk'],
  },
  ar: {
    protein: ['دجاج مشوي', 'بيض', 'زبادي يوناني'],
    carb: ['أرز', 'شوفان', 'خبز أسمر'],
    fat: ['زيت زيتون', 'لوز'],
    fruit: ['موز', 'تفاح', 'بلح'],
    dairy: ['زبادي', 'لبن'],
  },
};

function catalogFoodPicks(onboardingData, field, locale) {
  const raw = onboardingData?.[field];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const name =
        locale === 'ar'
          ? item.nameAr || item.displayName || item.nameEn || item.name || null
          : item.nameEn || item.displayName || item.name || null;
      if (!name) return null;
      const webtebId = Number(item.id);
      return {
        name: String(name),
        webtebId: Number.isFinite(webtebId) && webtebId > 0 ? Math.floor(webtebId) : null,
      };
    })
    .filter(Boolean);
}

function catalogFoodNames(onboardingData, field, locale) {
  return catalogFoodPicks(onboardingData, field, locale).map((p) => p.name);
}

function mealSlotLabels(count, locale) {
  const isAr = locale === 'ar';
  const main = isAr ? ['فطار', 'غداء', 'عشاء'] : ['Breakfast', 'Lunch', 'Dinner'];
  const snackLabels = isAr
    ? ['وجبة خفيفة ١', 'وجبة خفيفة ٢', 'وجبة خفيفة ٣']
    : ['Snack 1', 'Snack 2', 'Snack 3'];
  const slots = [...main];
  for (let i = 0; i < count - 3; i += 1) {
    slots.push(snackLabels[i] || (isAr ? `وجبة ${i + 4}` : `Meal ${i + 4}`));
  }
  return slots.slice(0, count);
}

function pickRotatingPick(pool, index, fallbackPool) {
  const list = pool.length ? pool : fallbackPool.map((name) => ({ name, webtebId: null }));
  if (!list.length) return null;
  return list[index % list.length];
}

function roundGrams(value) {
  return Math.max(5, Math.round(value / 5) * 5);
}

const ROLE_MACROS_PER_100G = {
  protein: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  carb: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  fat: { calories: 884, protein: 0, carbs: 0, fat: 100 },
  fruit: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  dairy: { calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
  mixed: { calories: 150, protein: 8, carbs: 15, fat: 5 },
};

function macrosForRole(role) {
  return ROLE_MACROS_PER_100G[role] || ROLE_MACROS_PER_100G.mixed;
}

function buildMealItem(name, role, grams, webtebId = null) {
  const macros = macrosForRole(role);
  const roundedGrams = roundGrams(grams);
  const factor = roundedGrams / 100;
  return {
    name,
    role,
    grams: roundedGrams,
    webtebId,
    calories: Math.round(macros.calories * factor),
    protein: Math.round(macros.protein * factor * 10) / 10,
    carbs: Math.round(macros.carbs * factor * 10) / 10,
    fat: Math.round(macros.fat * factor * 10) / 10,
  };
}

function sumItemMacros(items) {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function finalizeMealSlot(slot) {
  const totals = sumItemMacros(slot.items);
  return {
    ...slot,
    targetCalories: Math.round(totals.calories),
    targetProtein: slot.kind === 'snack' ? null : Math.round(totals.protein),
  };
}

function scaleMealPlanToTarget(slots, calorieTarget) {
  const rawTotal = slots.reduce((sum, slot) => sum + sumItemMacros(slot.items).calories, 0);
  if (rawTotal <= 0 || calorieTarget <= 0) {
    return slots.map(finalizeMealSlot);
  }

  const scale = calorieTarget / rawTotal;
  const scaled =
    Math.abs(scale - 1) < 0.02
      ? slots
      : slots.map((slot) => ({
          ...slot,
          items: slot.items.map((item) =>
            buildMealItem(item.name, item.role, item.grams * scale, item.webtebId)
          ),
        }));

  return scaled.map(finalizeMealSlot);
}

function gramsForMealItem(role, mealIndex, isSnack) {
  if (isSnack) {
    if (role === 'fruit') return 130;
    if (role === 'dairy') return 170;
    return 100;
  }
  if (role === 'protein') {
    return mealIndex === 0 ? 120 : mealIndex === 1 ? 150 : 140;
  }
  if (role === 'carb') {
    return mealIndex === 0 ? 70 : mealIndex === 1 ? 180 : 150;
  }
  if (role === 'fat') {
    return mealIndex === 0 ? 0 : mealIndex === 1 ? 12 : 15;
  }
  return 100;
}

function buildDailyMealPlan(profile, targets, locale = 'ar') {
  const isAr = locale === 'ar';
  const od =
    profile?.onboardingData && typeof profile.onboardingData === 'object' ? profile.onboardingData : {};
  const mealsPerDay = parseMealsPerDay(od.mealsPerDay);
  const defaults = DEFAULT_FOOD_POOLS[locale] || DEFAULT_FOOD_POOLS.en;

  const protein = catalogFoodPicks(od, 'proteinPrefs', locale);
  const carb = catalogFoodPicks(od, 'carbPrefs', locale);
  const fat = catalogFoodPicks(od, 'fatPrefs', locale);
  const fruit = catalogFoodPicks(od, 'fruitPrefs', locale);
  const dairy = catalogFoodPicks(od, 'dairyPrefs', locale);
  const defaultPicks = {
    protein: defaults.protein.map((name) => ({ name, webtebId: null })),
    carb: defaults.carb.map((name) => ({ name, webtebId: null })),
    fat: defaults.fat.map((name) => ({ name, webtebId: null })),
    fruit: defaults.fruit.map((name) => ({ name, webtebId: null })),
    dairy: defaults.dairy.map((name) => ({ name, webtebId: null })),
  };

  const labels = mealSlotLabels(mealsPerDay, locale);
  const calorieTarget = targets?.calorieTarget || 2000;
  const mainMealCount = Math.min(3, mealsPerDay);
  const snackCount = Math.max(0, mealsPerDay - 3);
  const snackCalShare = snackCount > 0 ? 0.15 : 0;
  const mainCalEach = Math.round(
    (calorieTarget * (1 - snackCalShare * snackCount)) / Math.max(1, mainMealCount)
  );
  const snackCalEach = snackCount > 0 ? Math.round(calorieTarget * snackCalShare) : 0;

  const rawSlots = labels.map((label, index) => {
    const isSnack = index >= 3;
    const items = [];

    if (isSnack) {
      const snackIdx = index - 3;
      const fruitPick = pickRotatingPick(fruit, snackIdx, defaultPicks.fruit);
      const dairyPick = pickRotatingPick(dairy, snackIdx, defaultPicks.dairy);
      if (fruitPick) {
        items.push(
          buildMealItem(
            fruitPick.name,
            'fruit',
            gramsForMealItem('fruit', index, true),
            fruitPick.webtebId
          )
        );
      }
      if (dairyPick && snackIdx % 2 === 0) {
        items.push(
          buildMealItem(
            dairyPick.name,
            'dairy',
            gramsForMealItem('dairy', index, true),
            dairyPick.webtebId
          )
        );
      }
    } else {
      const proteinPick = pickRotatingPick(protein, index, defaultPicks.protein);
      const carbPick = pickRotatingPick(carb, index, defaultPicks.carb);
      const fatPick = index >= 1 ? pickRotatingPick(fat, index - 1, defaultPicks.fat) : null;
      if (proteinPick) {
        items.push(
          buildMealItem(
            proteinPick.name,
            'protein',
            gramsForMealItem('protein', index, false),
            proteinPick.webtebId
          )
        );
      }
      if (carbPick) {
        items.push(
          buildMealItem(
            carbPick.name,
            'carb',
            gramsForMealItem('carb', index, false),
            carbPick.webtebId
          )
        );
      }
      if (fatPick) {
        const fatGrams = roundGrams(gramsForMealItem('fat', index, false));
        if (fatGrams > 0) {
          items.push(buildMealItem(fatPick.name, 'fat', fatGrams, fatPick.webtebId));
        }
      }
    }

    if (!items.length) {
      items.push(
        buildMealItem(
          isAr ? 'وجبة متوازنة' : 'Balanced meal',
          'mixed',
          roundGrams(isSnack ? snackCalEach / 2 : mainCalEach / 2)
        )
      );
    }

    return {
      id: `meal-${index}`,
      label,
      kind: isSnack ? 'snack' : 'meal',
      items,
    };
  });

  const slots = scaleMealPlanToTarget(rawSlots, calorieTarget);
  const planTotalCalories = slots.reduce((sum, slot) => sum + slot.targetCalories, 0);

  return {
    mealsPerDay,
    mainMeals: mainMealCount,
    snacks: snackCount,
    planTotalCalories,
    slots,
  };
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

function exerciseCatalogLabel(item) {
  if (typeof item === 'string') {
    const trimmed = item.trim();
    return trimmed || null;
  }
  if (item && typeof item === 'object') {
    const name =
      item.nameEn || item.displayName || item.name || item.nameAr || item.label || null;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  }
  return null;
}

function defaultWorkoutExercises(fitnessGoal, onboardingData = {}, locale = 'ar') {
  const key = splitKey(onboardingData.preferredSplit, fitnessGoal);
  const base = SPLIT_EXERCISES[key] || SPLIT_EXERCISES.full;
  const loved = arr(onboardingData.exercisesLove)
    .map(exerciseCatalogLabel)
    .filter(Boolean)
    .slice(0, 2);
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

function buildAiAlertItem({
  id,
  category,
  key,
  params,
  priority = 'medium',
  source = 'rule',
  message = null,
  link = null,
}) {
  return {
    id,
    category,
    source,
    priority,
    key: key ?? null,
    params: params ?? undefined,
    message,
    link,
    createdAt: new Date().toISOString(),
  };
}

function buildAiAlerts({ profile, today, targets, totals, weekly, personalization }) {
  const nutrition = [];
  const workout = [];
  const health = [];
  const goal = String(personalization?.goal || profile?.fitnessGoal || '').toLowerCase();
  const proteinTarget = Math.round(targets.proteinTarget);
  const proteinToday = Math.round(today.nutrition.protein);
  const plannedDays = personalization?.trainingDaysPerWeek || 4;
  const waterTarget = String(personalization?.waterTargetMl || 2500);

  if (proteinToday < proteinTarget * 0.75) {
    nutrition.push(
      buildAiAlertItem({
        id: 'nutrition-protein',
        category: 'nutrition',
        key: 'protein',
        params: { target: String(proteinTarget) },
        priority: 'high',
        link: '/nutrition',
      })
    );
  }

  const workoutDays = weekly.filter((d) => d.workouts > 0).length;
  if (workoutDays < plannedDays) {
    workout.push(
      buildAiAlertItem({
        id: 'workout-cardio',
        category: 'workout',
        key: 'cardio',
        link: '/workouts',
      })
    );
  }

  const calorieGap = targets.calorieTarget - today.nutrition.calories;
  if (goal.includes('muscle') || goal.includes('gain')) {
    if (calorieGap > 200) {
      nutrition.push(
        buildAiAlertItem({
          id: 'nutrition-cal-up',
          category: 'nutrition',
          key: 'caloriesUp',
          link: '/nutrition',
        })
      );
    }
  } else if (goal.includes('lose') || goal.includes('fat')) {
    if (today.nutrition.calories > targets.calorieTarget * 1.08) {
      nutrition.push(
        buildAiAlertItem({
          id: 'nutrition-cal-down',
          category: 'nutrition',
          key: 'caloriesDown',
          priority: 'high',
          link: '/nutrition',
        })
      );
    }
  } else if (calorieGap > 250) {
    nutrition.push(
      buildAiAlertItem({
        id: 'nutrition-cal-up',
        category: 'nutrition',
        key: 'caloriesUp',
        link: '/nutrition',
      })
    );
  }

  if (personalization?.sleepLabel && String(personalization.sleepLabel).includes('5')) {
    health.push(
      buildAiAlertItem({
        id: 'health-sleep-alert',
        category: 'health',
        key: 'sleepRecovery',
        params: { goal: personalization.goalLabel || personalization.goal || 'your fitness' },
        priority: 'high',
        link: '/profile',
      })
    );
  } else {
    health.push(
      buildAiAlertItem({
        id: 'health-sleep',
        category: 'health',
        key: 'sleepWellness',
        priority: 'low',
        link: '/profile',
      })
    );
  }

  health.push(
    buildAiAlertItem({
      id: 'health-hydration',
      category: 'health',
      key: 'hydration',
      params: { target: waterTarget },
      priority: 'low',
      link: '/profile',
    })
  );

  if (personalization?.injuries?.length) {
    workout.push(
      buildAiAlertItem({
        id: 'workout-injury',
        category: 'workout',
        key: 'trainSafe',
        params: { area: personalization.injuries[0] },
        priority: 'high',
        link: '/workouts',
      })
    );
  }

  if (workout.length < 2 && totals.workouts < plannedDays) {
    workout.push(
      buildAiAlertItem({
        id: 'workout-training',
        category: 'workout',
        key: 'training',
        link: '/workouts',
      })
    );
  }
  if (nutrition.length < 2 && today.nutrition.logCount === 0) {
    nutrition.push(
      buildAiAlertItem({
        id: 'nutrition-log-meals',
        category: 'nutrition',
        key: 'logMeals',
        priority: 'high',
        link: '/nutrition',
      })
    );
  }
  if (workout.length < 2 && today.workouts.length === 0) {
    workout.push(
      buildAiAlertItem({
        id: 'workout-today',
        category: 'workout',
        key: 'todayWorkout',
        priority: 'high',
        link: '/workouts',
      })
    );
  }

  if (!nutrition.length) {
    nutrition.push(
      buildAiAlertItem({
        id: 'nutrition-default',
        category: 'nutrition',
        key: 'logMeals',
        priority: 'low',
        link: '/nutrition',
      })
    );
  }
  if (!workout.length) {
    workout.push(
      buildAiAlertItem({
        id: 'workout-default',
        category: 'workout',
        key: 'todayWorkout',
        priority: 'low',
        link: '/workouts',
      })
    );
  }

  if (!health.length) {
    health.push(
      buildAiAlertItem({
        id: 'health-default',
        category: 'health',
        key: 'sleepWellness',
        priority: 'low',
        link: '/profile',
      })
    );
  }

  return {
    nutrition: nutrition.slice(0, 2),
    workout: workout.slice(0, 2),
    health: health.slice(0, 2),
    generatedAt: new Date().toISOString(),
    source: 'rule',
  };
}

function buildAiRecommendations(ctx) {
  const alerts = buildAiAlerts(ctx);
  return [...alerts.nutrition, ...alerts.workout, ...alerts.health].map(({ id, category, key, params }) => ({
    id,
    category,
    key,
    params,
  }));
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
    mealsPerDayCount: parseMealsPerDay(od.mealsPerDay),
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

async function enrichDailyMealPlanWithDbMacros(prismaClient, plan) {
  if (!plan?.slots?.length) return plan;

  const webtebIds = [
    ...new Set(
      plan.slots.flatMap((slot) =>
        slot.items.map((item) => item.webtebId).filter((id) => Number.isFinite(id) && id > 0)
      )
    ),
  ];

  let webtebById = new Map();
  if (webtebIds.length) {
    const rows = await prismaClient.webtebFood.findMany({
      where: { webtebId: { in: webtebIds } },
    });
    webtebById = new Map(rows.map((row) => [row.webtebId, row]));
  }

  const slots = plan.slots.map((slot) => {
    const items = slot.items.map((item) => {
      const webteb = item.webtebId ? webtebById.get(item.webtebId) : null;
      const per100 = webteb
        ? { calories: webteb.calories, protein: webteb.protein, carbs: webteb.carbs, fat: webteb.fat }
        : macrosForRole(item.role);
      const factor = item.grams / 100;
      return {
        ...item,
        macrosPer100: per100,
        calories: Math.round(per100.calories * factor),
        protein: Math.round(per100.protein * factor * 10) / 10,
        carbs: Math.round(per100.carbs * factor * 10) / 10,
        fat: Math.round(per100.fat * factor * 10) / 10,
      };
    });
    return finalizeMealSlot({ ...slot, items });
  });

  const planTotalCalories = slots.reduce((sum, slot) => sum + slot.targetCalories, 0);
  return { ...plan, slots, planTotalCalories };
}

async function enrichTodayWorkoutExercises(prismaClient, exercises) {
  if (!Array.isArray(exercises) || !exercises.length) return exercises;
  const names = exercises
    .map((ex) => exerciseCatalogLabel(ex.name) ?? exerciseCatalogLabel(ex))
    .filter(Boolean);
  const dbRows = names.length
    ? await prismaClient.exercise.findMany({
        where: {
          isPublic: true,
          OR: names.map((name) => ({ name: { equals: name, mode: 'insensitive' } })),
        },
      })
    : [];
  const byName = new Map(dbRows.map((row) => [row.name.toLowerCase(), row]));
  return exercises.map((ex) => {
    const label = exerciseCatalogLabel(ex.name) ?? exerciseCatalogLabel(ex);
    const db = ex.exerciseId
      ? dbRows.find((row) => row.id === ex.exerciseId) ??
        (label ? byName.get(label.toLowerCase()) : undefined)
      : label
        ? byName.get(label.toLowerCase())
        : undefined;
    if (!db) return label ? { ...ex, name: label } : ex;
    return {
      ...ex,
      exerciseId: db.id,
      name: db.name,
      nameAr: db.nameAr ?? ex.nameAr,
      category: db.category,
      difficulty: db.difficulty,
    };
  });
}

module.exports = {
  buildAthletePersonalization,
  buildWeekPlan,
  buildCoachTip,
  buildAiAlerts,
  buildAiRecommendations,
  buildDailyMealPlan,
  enrichDailyMealPlanWithDbMacros,
  enrichTodayWorkoutExercises,
  defaultWorkoutExercises,
  estimateTargets,
  waterTargetMl,
  localizeValue,
  parseMealsPerDay,
};
