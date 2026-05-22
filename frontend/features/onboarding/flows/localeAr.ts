import type { QuestionnaireFlowId } from './types';
import type { OnboardingStep } from '../types';
import type { StepLocalePatch } from '../localizeAthleteSteps';
import { AR_ATHLETE_STEP_LOCALE } from '../athleteStepLocale.ar';

const FLOW_EXTRA_AR: Record<string, StepLocalePatch> = {
  bodyMeasurements: {
    title: 'قياسات الجسم (اختياري)',
    subtitle: 'صدر، خصر، وركين — لتتبع التقدم',
    chatMessage: 'لو حابب، اكتب محيطات جسمك — مش إجباري بس بيفيدنا نتابع التقدم.',
  },
  activityLevel: {
    title: 'مستوى نشاطك اليومي',
    subtitle: 'خارج الجيم — بيأثر على السعرات والتعافي',
    options: {
      sedentary: { label: 'قاعد معظم اليوم' },
      light: { label: 'خفيف' },
      moderate: { label: 'متوسط' },
      active: { label: 'نشيط' },
      very_active: { label: 'نشيط جداً' },
    },
  },
  lastTraining: {
    title: 'آخر تمرين منتظم',
    options: {
      never: { label: 'ما تمرّنتش بانتظام' },
      under_3m: { label: 'بقالي أقل من ٣ شهور' },
      '3_12m': { label: 'من ٣ لـ ١٢ شهر' },
      over_1y: { label: 'أكتر من سنة' },
      current: { label: 'بتمارّن دلوقتي' },
    },
  },
  inbodyScan: {
    title: 'قياس InBody',
    subtitle: 'اختياري — مطلوب لإكمال القسم',
    chatMessage: 'لو عندك InBody، اكتب النسب أو ارفع صورة التقرير.',
  },
  progressPhotos: {
    title: 'صور من الأمام والخلف',
    subtitle: 'مطلوب لإكمال القسم',
    chatMessage: 'صورتين بسيطتين — أمام وخلف — علشان نتابع شكلك.',
  },
  goal12Week: {
    title: 'هدفك لـ ١٢ أسبوع',
    placeholder: 'مثال: أنزل ٥ كيلو دهون، أقوى في البنش…',
  },
  trainingDaysPerWeek: {
    title: 'كم يوم تمرين في الأسبوع؟',
    options: {
      '2': { label: 'يومين' },
      '3': { label: '٣ أيام' },
      '4': { label: '٤ أيام' },
      '5': { label: '٥ أيام' },
      '6': { label: '٦ أيام' },
    },
  },
  gymLink: {
    title: 'اربط صالتك',
    placeholder: 'اسم الصالة أو اختار من قائمة تكوين',
  },
  preferredSplit: {
    title: 'تقسيمة أو جدول معين؟',
    options: {
      full_body: { label: 'جسم كامل' },
      upper_lower: { label: 'علوي / سفلي' },
      ppl: { label: 'Push / Pull / Legs' },
      bro: { label: 'Bro split' },
      coach: { label: 'الكوتش يقرر' },
    },
  },
  exercisesAvoid: {
    title: 'تمارين مش عايزها في الجدول',
    placeholder: 'مثال: burpees، leg press…',
  },
  exercisesLove: {
    title: 'تمارين عايزها تفضل موجودة',
    placeholder: 'مثال: بنش، تسليط…',
  },
  pullups: {
    title: 'تقدر تعمل كام عقلة؟',
    options: {
      '0': { label: 'لسه لا' },
      lt5: { label: '١–٥' },
      '6_12': { label: '٦–١٢' },
      gt12: { label: 'أكتر من ١٢' },
      unknown: { label: 'مش عارف' },
    },
  },
  strengthEquipment: {
    title: 'معدات القوة المتاحة',
    options: {
      barbell: { label: 'بار وراك' },
      dumbbells: { label: 'دمبل' },
      cables: { label: 'كابلات' },
      machines: { label: 'أجهزة' },
      kettlebells: { label: 'كيتل' },
      bands: { label: 'حبال مقاومة' },
      bodyweight: { label: 'وزن الجسم بس' },
    },
  },
  goal12WeekPace: {
    title: 'شدة الهدف لـ ١٢ أسبوع',
    options: {
      fast: { label: 'بسرعة' },
      balanced: { label: 'متوازن' },
      calm: { label: 'على مهل' },
    },
  },
  restDaysPreference: {
    title: 'أيام الراحة',
    options: {
      fixed: { label: 'أيام راحة ثابتة' },
      coach: { label: 'الكوتش يحدد' },
      minimal: { label: 'أقل راحة ممكنة' },
    },
  },
  liftExperience: {
    title: 'خبرتك في الرفعات الأساسية',
    options: {
      deadlift_new: { label: 'ديدليفت جديد' },
      squat_new: { label: 'سكوات جديد' },
      bench_new: { label: 'بنش جديد' },
      deadlift_ok: { label: 'مرتاح في ديدليفت' },
      squat_ok: { label: 'مرتاح في سكوات' },
      bench_ok: { label: 'مرتاح في بنش' },
    },
  },
  foodAllergies: {
    title: 'حساسية أو عدم تحمل أكل؟',
    options: {
      none: { label: 'لا' },
      nuts: { label: 'مكسرات' },
      gluten: { label: 'جلوتين' },
      lactose: { label: 'لاكتوز' },
      shellfish: { label: 'مأكولات بحرية' },
      eggs: { label: 'بيض' },
      other: { label: 'أخرى' },
    },
  },
  foodsExcluded: {
    title: 'أكل مرفوض نهائياً من خطتك',
    placeholder: 'اكتب أي أكل مش عايز تشوفه',
  },
  dietType: {
    title: 'نوع الدايت المفضل',
    options: {
      balanced: { label: 'متوازن' },
      high_protein: { label: 'بروتين عالي' },
      low_carb: { label: 'كارب أقل' },
      mediterranean: { label: 'متوسطي' },
      vegetarian: { label: 'نباتي' },
      other: { label: 'أخرى' },
    },
  },
  mealPlanStyle: {
    title: 'ثابت أسبوعي أم متغير يومياً؟',
    options: {
      fixed_weekly: { label: 'نفس الأكل كل أسبوع' },
      rotating_daily: { label: 'متغير يومياً' },
    },
  },
  mealsPerDay: {
    title: 'عدد الوجبات في اليوم',
    options: {
      '3': { label: '٣ وجبات' },
      '4': { label: '٤ وجبات' },
      '5': { label: '٥ وجبات' },
      '6': { label: '٦ وجبات' },
    },
  },
  proteinPrefs: {
    title: 'بروتينات مفضلة',
    options: {
      beef: { label: 'لحم' },
      chicken: { label: 'دجاج' },
      fish: { label: 'سمك' },
      tuna: { label: 'تونة' },
      salmon: { label: 'سلمون' },
      beef_liver: { label: 'كبد بقري' },
      chicken_liver: { label: 'كبد دجاج' },
      eggs: { label: 'بيض' },
    },
  },
  carbPrefs: {
    title: 'كارب مفضل',
    options: {
      rice: { label: 'رز' },
      potatoes: { label: 'بطاطس' },
      sweet_potato: { label: 'بطاطا حلوة' },
      brown_pasta: { label: 'مكرونة بني' },
      oats: { label: 'شوفان' },
      quinoa: { label: 'كينوا' },
      brown_toast: { label: 'توست بني' },
    },
  },
  fatPrefs: {
    title: 'دهون صحية مفضلة',
    options: {
      olive_oil: { label: 'زيت زيتون' },
      coconut_oil: { label: 'زيت جوز الهند' },
      butter: { label: 'زبدة' },
      egg_yolk: { label: 'صفار بيض' },
      nuts: { label: 'مكسرات' },
      avocado: { label: 'أفوكادو' },
      peanut_butter: { label: 'زبدة فول سوداني' },
    },
  },
  fruitPrefs: { title: 'فواكه مفضلة' },
  dairyPrefs: {
    title: 'ألبان مفضلة',
    options: {
      milk: { label: 'لبن' },
      yogurt: { label: 'زبادي' },
      cheese: { label: 'جبن' },
      none: { label: 'بدون ألبان' },
    },
  },
  supplementsBudget: {
    title: 'مكملات وميزانية',
    placeholder: 'إيه اللي بتستخدمه وإيه تقدر تجيبه',
  },
  foodBudget: {
    title: 'ميزانية الأكل',
    options: {
      low: { label: 'منخفضة' },
      medium: { label: 'متوسطة' },
      high: { label: 'عالية' },
    },
  },
  mealPrepTime: {
    title: 'وقت تحضير الأكل',
    options: {
      '5': { label: 'حوالي ٥ دقائق' },
      '30': { label: 'حوالي ٣٠ دقيقة' },
      '60': { label: 'ساعة أو أكتر' },
    },
  },
  cookOrReady: {
    title: 'بتطبخ ولا جاهز؟',
    options: {
      cook: { label: 'بطبخ' },
      ready: { label: 'جاهز / دليفري' },
      mixed: { label: 'الاتنين' },
    },
  },
  religiousDiet: {
    title: 'قيود دينية أو ثقافية',
    options: {
      none: { label: 'لا' },
      halal: { label: 'حلال' },
      ramadan: { label: 'صيام رمضان' },
      vegan_strict: { label: 'نباتي صارم' },
    },
  },
  calorieTarget: {
    title: 'هدف السعرات',
    options: {
      coach: { label: 'الكوتش يحدد' },
      deficit_aggressive: { label: 'تنشيف قوي' },
      deficit_mild: { label: 'تنشيف خفيف' },
      maintain: { label: 'ثبات' },
      surplus: { label: 'زيادة عضل' },
    },
  },
  medicalHistory: {
    title: 'تاريخ مرضي',
    placeholder: 'أمراض، عمليات، حالات مزمنة…',
  },
  medications: {
    title: 'أدوية حالية',
    placeholder: 'أدوية تؤثر على الوزن أو التمرين',
  },
  pastInjuriesHistory: {
    title: 'إصابات سابقة (تعافيت منها)',
  },
  doctorClearance: {
    title: 'موافقة طبية للرياضة؟',
    options: {
      yes: { label: 'أيوه' },
      no: { label: 'لأ' },
      not_needed: { label: 'مش محتاج' },
    },
  },
  progressTracking: {
    title: 'كيف تلاحظ التقدم؟',
    options: {
      mirror: { label: 'مراية / صور' },
      scale: { label: 'ميزان' },
      strength: { label: 'أرقام قوة' },
      energy: { label: 'طاقة ومزاج' },
      measurements: { label: 'قياسات' },
      comments: { label: 'تعليقات الناس' },
    },
  },
  hungerScale: {
    title: 'متوسط جوعك في اليوم (١–١٠)',
  },
  motivationStart: {
    title: 'إيه اللي خلّاك تبدأ؟',
    subtitle: 'اختار اللي ينطبق',
  },
};

function patchStep(step: OnboardingStep, patch?: StepLocalePatch): OnboardingStep {
  if (!patch) return step;
  const base = {
    title: patch.title ?? step.title,
    subtitle: 'subtitle' in step && patch.subtitle !== undefined ? patch.subtitle : 'subtitle' in step ? step.subtitle : undefined,
    chatMessage: patch.chatMessage ?? ('chatMessage' in step ? step.chatMessage : undefined),
    encouragement: patch.encouragement ?? ('encouragement' in step ? step.encouragement : undefined),
  };
  if (step.type === 'single' || step.type === 'multi') {
    const loc = patch.options;
    return {
      ...step,
      ...base,
      options: step.options.map((o) => ({
        ...o,
        label: loc?.[o.value]?.label ?? o.label,
        description: loc?.[o.value]?.description ?? o.description,
      })),
    };
  }
  if (step.type === 'text') {
    return { ...step, ...base, placeholder: patch.placeholder ?? step.placeholder };
  }
  return { ...step, ...base };
}

/** Apply Arabic patches for a flow (base locale + flow extras). */
export function localizeFlowSteps(_flow: QuestionnaireFlowId, steps: OnboardingStep[]): OnboardingStep[] {
  return steps.map((step) => {
    const patch = AR_ATHLETE_STEP_LOCALE[step.id] ?? FLOW_EXTRA_AR[step.id];
    return patchStep(step, patch);
  });
}
