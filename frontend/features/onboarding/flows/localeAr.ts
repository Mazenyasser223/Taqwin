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
  weightHistory: {
    title: 'وزنك كان كام من 6 شهور؟',
    subtitle: 'يعرفنا إنك ثابت، بتزيد، ولا بتنقص',
    chatMessage: 'وزنك كان كام من 6 شهور؟\nعلشان نعرف مسارك — ثابت، بتزيد، ولا بتنقص.',
  },
  goalDeadline: {
    title: 'عايز توصل لهدفك إمتى؟',
    subtitle: 'أنزل 10 كيلو في 3 شهور ≠ أنزل 10 كيلو في 12 شهر',
    chatMessage: 'عايز توصل لهدفك إمتى؟\nأنزل 10 كيلو في 3 شهور ≠ أنزل 10 كيلو في 12 شهر.',
    options: {
      '1_month': { label: 'شهر' },
      '3_months': { label: '3 شهور' },
      '6_months': { label: '6 شهور' },
      '12_months': { label: '12 شهر' },
      no_deadline: { label: 'بدون موعد محدد' },
    },
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
    subtitle: 'اختياري لكن مُوصى به — يحسّن خطط التمرين والتغذية',
    chatMessage:
      'ارفع تقرير InBody زي المثال (PDF أو صورة) علشان نبني خطط أدق — أو أدخل القيم يدوياً أو تخطّى.',
  },
  progressPhotos: {
    title: 'صور من الأمام والجانب والخلف',
    subtitle: 'اختياري — أمام وجانب وخلف لتتبع الخصر والصدر والوضعية',
    chatMessage: 'ارفع ٣ صور بسيطة — أمام، جانب، وخلف — علشان نتابع تقدمك (اختياري).',
  },
  trainingDaysPerWeek: {
    title: 'كم يوم تمرين في الأسبوع؟',
    subtitle: 'اختار كام يوم تقدر تلتزم بيهم فعلاً كل أسبوع',
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
    subtitle: 'اختار صالتك من تكوين أو اكتب اسمها',
    placeholder: 'اسم الصالة لو مش موجودة في القائمة…',
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
    subtitle: 'اختار من مكتبتنا — ابحث أو تصفّح',
    chatMessage: 'في تمارين مش عايزها؟ اختار اللي عايز تستبعدها — أو كمّل لو مفيش.',
  },
  exercisesLove: {
    title: 'تمارين عايزها تفضل موجودة',
    subtitle: 'المفضّلة من مكتبتنا',
    chatMessage: 'إيه التمارين اللي بتحبها؟ اختار شوية علشان نحطها في برنامجك.',
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
  trainingObstacle: {
    title: 'إيه أكبر عائق بيوقف تمرينك؟',
    subtitle: 'اختار كل اللي ينطبق — بنظبط أوضاع الحياة وتعديلات الأسبوع والخطة حواليهم',
    options: {
      no_time: { label: 'مفيش وقت' },
      low_motivation: { label: 'حماس قليل' },
      work_schedule: { label: 'دوام الشغل' },
      travel: { label: 'سفر' },
      recovery: { label: 'تعافي' },
      pain: { label: 'ألم' },
      family: { label: 'مسؤوليات عيلة' },
      other: { label: 'أخرى' },
    },
  },
  restDaysPreference: {
    title: 'أيام الراحة',
    subtitle: 'لو اخترت أيام ثابتة، حدّد أيام الراحة حسب جدول تمرينك',
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
      lactose: { label: 'لاكتوز / ألبان' },
      shellfish: { label: 'قشريات (جمبري، كابوريا…)' },
      fish: { label: 'سمك' },
      eggs: { label: 'بيض' },
      soy: { label: 'صويا' },
      sesame: { label: 'سمسم' },
      other: { label: 'أخرى' },
    },
  },
  foodsExcluded: {
    title: 'أكل مرفوض نهائياً من خطتك',
    subtitle: 'تصفّح الأقسام، ابحث، أو اكتب الأكل المرفوض',
    chatMessage: 'أكل مش عايز تشوفه أبداً؟ اختاره — أو تخطّى لو مفيش.',
  },
  dietType: {
    title: 'نوع الدايت المفضل',
    options: {
      balanced: { label: 'متوازن' },
      high_protein: { label: 'بروتين عالي' },
      low_carb: { label: 'كارب أقل' },
      keto: { label: 'كيتو' },
      mediterranean: { label: 'متوسطي' },
      vegetarian: { label: 'نباتي' },
      pescatarian: { label: 'نباتي + سمك' },
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
    title: 'عدد الوجبات والسناكس في اليوم',
    subtitle: 'كم وجبة رئيسية وكم سناك؟',
  },
  proteinPrefs: {
    title: 'بروتينات مفضلة',
    subtitle: 'اختار اللي بتحبه — أو حوّل لوضع «مش مفضل» عشان تستبعد',
    chatMessage: 'إيه البروتينات اللي بتحبها أو مش عايزها؟ تصفّح واختار.',
  },
  carbPrefs: {
    title: 'كارب مفضل',
    subtitle: 'اختار اللي بتحبه — أو حوّل لوضع «مش مفضل» عشان تستبعد',
    chatMessage: 'إيه الكارب اللي بتحبه أو مش عايزه؟ تصفّح واختار.',
  },
  fatPrefs: {
    title: 'دهون صحية مفضلة',
    subtitle: 'اختار اللي بتحبه — أو حوّل لوضع «مش مفضل» عشان تستبعد',
    chatMessage: 'دهون صحية بتحبها أو بتتجنبها — تصفّح واختار.',
  },
  fruitPrefs: {
    title: 'فواكه وخضروات مفضلة',
    subtitle: 'اختار اللي بتحبه — أو حوّل لوضع «مش مفضل» عشان تستبعد',
    chatMessage: 'فواكه وخضرواتك المفضلة — أو اللي مش عايزها.',
  },
  dairyPrefs: {
    title: 'ألبان مفضلة',
    lactoseFreeTitle: 'تفضيلات ألبان خالية من اللاكتوز',
    subtitle: 'اختار اللي بتحبه — أو حوّل لوضع «مش مفضل» عشان تستبعد',
    lactoseFreeSubtitle: 'اختار ألبان خالية من اللاكتوز بس — أو حوّل لوضع «مش مفضل»',
    chatMessage: 'ألبان بتحبها أو بتتجنبها — أو تخطّى لو مش بتستخدم ألبان.',
  },
  supplementsBudget: {
    title: 'مكملات',
    subtitle: 'إيه اللي بتاخده دلوقتي — اختياري',
    placeholder: 'مثلاً: واي بروتين، كرياتين، فيتامينات، أوميجا 3…',
    chatMessage: 'بتستخدم مكملات؟ اكتبها — أو تخطّى لو مفيش.',
  },
  weekendEating: {
    title: 'أكلك بيتغير في الويك إند؟',
    options: {
      no: { label: 'لا' },
      slightly: { label: 'شوية' },
      a_lot: { label: 'كثير' },
    },
  },
  foodBudget: {
    title: 'ميزانية الأكل',
    options: {
      low: { label: 'منخفضة' },
      medium: { label: 'متوسطة' },
      high: { label: 'عالية' },
    },
  },
  eatingOutFrequency: {
    title: 'بتاكل برّه أو دليفري قد إيه؟',
    options: {
      '0': { label: '٠ مرات في الأسبوع' },
      '1_2_week': { label: '1–2 مرات في الأسبوع' },
      '3_5_week': { label: '3–5 مرات في الأسبوع' },
      daily: { label: 'يوميًا' },
    },
  },
  preferSimpleMeals: {
    title: 'بتحب وجبات بسيطة؟',
    subtitle: 'مكونات قليلة وخطوات سريعة',
    options: {
      yes: { label: 'أيوه' },
      no: { label: 'لا' },
    },
  },
  mealPrepTime: {
    title: 'وقت تحضير الأكل',
    subtitle: 'اختار النطاق اللي يناسبك في أغلب الأيام',
    options: {
      '0_15': { label: '٠–١٥ دقيقة' },
      '15_30': { label: '١٥–٣٠ دقيقة' },
      '30_60': { label: '٣٠–٦٠ دقيقة' },
      '60_plus': { label: 'ساعة أو أكتر' },
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
    subtitle: 'اختار كل اللي ينطبق عليك',
    options: {
      halal: { label: 'حلال' },
      ramadan: { label: 'صيام رمضان' },
      christian_fasting: { label: 'صيام مسيحي (الصوم الكبير وأيام الصوم)' },
      vegan_strict: { label: 'نباتي صارم' },
      none: { label: 'لا' },
    },
  },
  medicalHistory: {
    title: 'تاريخ مرضي',
    subtitle: 'اختار كل اللي ينطبق — وممكن تضيف تفاصيل تحت',
    options: {
      hypertension: { label: 'ضغط دم مرتفع' },
      diabetes: { label: 'سكري' },
      heart_condition: { label: 'مشكلة في القلب' },
      asthma: { label: 'ربو / مشاكل تنفس' },
      thyroid: { label: 'غدة درقية' },
      high_cholesterol: { label: 'كوليسترول مرتفع' },
      joint_arthritis: { label: 'التهاب مفاصل / ألم مزمن' },
      back_spine: { label: 'ظهر أو عمود فقري' },
      eating_disorder: { label: 'اضطراب أكل (سابق أو حالي)' },
      surgery_recent: { label: 'عملية خلال 12 شهر' },
      other_chronic: { label: 'حالة مزمنة أخرى' },
      none: { label: 'لا — لا توجد حالات معروفة' },
    },
  },
  medications: {
    title: 'أدوية حالية',
    subtitle: 'اختياري — أي دواء يأثر على الوزن أو التمرين',
    placeholder: 'أدوية تؤثر على الوزن أو التمرين',
  },
  pastInjuriesHistory: {
    title: 'إصابات سابقة (تعافيت منها)',
    subtitle: 'اختار كل اللي ينطبق',
    options: {
      neck: { label: 'رقبة' },
      shoulders: { label: 'كتف' },
      upper_back: { label: 'ظهر علوي' },
      lower_back: { label: 'ظهر سفلي' },
      chest: { label: 'صدر' },
      arms: { label: 'إيد' },
      elbows: { label: 'مرفق' },
      wrists: { label: 'معصم' },
      hips: { label: 'ورك' },
      knees: { label: 'ركبة' },
      ankles: { label: 'كاحل' },
      legs: { label: 'رجل' },
      none: { label: 'لا، مفيش' },
    },
  },
  doctorClearance: {
    title: 'موافقة طبية للرياضة؟',
    options: {
      yes: { label: 'أيوه' },
      no: { label: 'لأ' },
      not_needed: { label: 'مش محتاج' },
    },
  },
  recoveryFeel: {
    title: 'بتتعافى إزاي بعد التمرين؟',
    options: {
      fast: { label: 'سريع' },
      normal: { label: 'عادي' },
      slow: { label: 'بطيء' },
      sore_days: { label: 'وجع لأيام' },
      not_sure: { label: 'مش متأكد' },
    },
  },
  stressLevel: {
    title: 'مستوى الضغط النفسي؟',
  },
  energyLevel: {
    title: 'متوسط طاقتك اليومية؟',
  },
  dailyRoutine: {
    title: 'طبيعة يومك؟',
    options: {
      desk_job: { label: 'شغل مكتبي' },
      standing_job: { label: 'شغل واقف' },
      physical_job: { label: 'شغل بدني' },
      student: { label: 'طالب' },
      variable_schedule: { label: 'جدول متغير' },
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
      none: { label: 'لا — مش متأكد بعد' },
    },
  },
  hungerScale: {
    title: 'متوسط جوعك في اليوم (١–١٠)',
  },
  motivationStart: {
    title: 'إيه اللي خلّاك تبدأ؟',
    subtitle: 'اختار اللي ينطبق',
    options: {
      visual: { label: 'مراية / ميزان' },
      fitness: { label: 'مستوى لياقة' },
      health: { label: 'صحة' },
      clothing: { label: 'ملابس' },
      aging: { label: 'تقدم العمر' },
      confidence: { label: 'ثقة / تقدير الذات' },
      performance: { label: 'أداء رياضي' },
      doctor_rec: { label: 'توصية طبيب' },
      none: { label: 'لا شيء مما سبق' },
    },
  },
  femaleHealthIntro: {
    title: 'صحة المرأة — اختياري',
    body: 'الأسئلة دي اختيارية وخاصة. تقدري تتخطي أي سؤال — وتعدّلي إجاباتك في أي وقت.',
    highlight: 'اختياري · خاص · تخطي في أي وقت',
    cta: 'متابعة',
  },
  cycleRegularity: {
    title: 'هل دورتك منتظمة؟',
    subtitle: 'اختياري — يساعدنا نفهم الطاقة والتعافي',
    options: {
      regular: { label: 'منتظمة' },
      irregular: { label: 'غير منتظمة' },
      not_sure: { label: 'مش متأكدة' },
      prefer_not_to_say: { label: 'أفضل عدم الإجابة' },
    },
  },
  cycleSymptoms: {
    title: 'إيه الأعراض اللي بتمرّي بيها عادةً؟',
    subtitle: 'اختياري — اختاري كل اللي ينطبق',
    options: {
      fatigue: { label: 'تعب' },
      bloating: { label: 'انتفاخ' },
      cravings: { label: 'اشتهاء' },
      mood_changes: { label: 'تغيّرات مزاج' },
      cramps: { label: 'تقلصات' },
      headaches: { label: 'صداع' },
      none: { label: 'لا شيء' },
    },
  },
  pregnancyStatus: {
    title: 'هل أنتِ حامل حالياً؟',
    options: {
      yes: { label: 'نعم' },
      no: { label: 'لا' },
      prefer_not_to_say: { label: 'أفضل عدم الإجابة' },
    },
  },
  postpartumStatus: {
    title: 'هل أنتِ في فترة ما بعد الولادة؟',
    options: {
      no: { label: 'لا' },
      lt_6m: { label: 'أقل من 6 أشهر' },
      '6_12m': { label: '6–12 شهر' },
      gt_12m: { label: 'أكثر من 12 شهر' },
      prefer_not_to_say: { label: 'أفضل عدم الإجابة' },
    },
  },
  breastfeeding: {
    title: 'هل ترضعين طبيعياً؟',
    options: {
      yes: { label: 'نعم' },
      no: { label: 'لا' },
    },
  },
  femaleHealthConditions: {
    title: 'هل عندك أي من هذه الحالات؟',
    subtitle: 'اختياري — ليس تشخيصاً؛ يساعد في تخصيص التغذية والتعافي',
    options: {
      pcos: { label: 'تكيس المبايض PCOS' },
      thyroid: { label: 'غدة درقية' },
      anemia: { label: 'فقر دم' },
      insulin_resistance: { label: 'مقاومة أنسولين' },
      endometriosis: { label: 'بطانة رحم مهاجرة' },
      none: { label: 'لا شيء' },
      prefer_not_to_say: { label: 'أفضل عدم الإجابة' },
    },
  },
  birthControl: {
    title: 'هل تستخدمين وسيلة منع حمل هرمونية؟',
    options: {
      yes: { label: 'نعم' },
      no: { label: 'لا' },
      prefer_not_to_say: { label: 'أفضل عدم الإجابة' },
    },
  },
  menopause: {
    title: 'هل أنتِ في سن اليأس؟',
    subtitle: 'اختياري',
    options: {
      yes: { label: 'نعم' },
      perimenopause: { label: 'ما قبل سن اليأس' },
      no: { label: 'لا' },
      prefer_not_to_say: { label: 'أفضل عدم الإجابة' },
    },
  },
  cycleLength: {
    title: 'متوسط طول الدورة؟',
    options: {
      '21_24': { label: '21–24 يوم' },
      '25_30': { label: '25–30 يوم' },
      '31_35': { label: '31–35 يوم' },
      irregular: { label: 'غير منتظمة' },
      prefer_not_to_say: { label: 'أفضل عدم الإجابة' },
    },
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

/** Localize a single questionnaire step (for dossier / read-only views). */
export function localizeQuestionnaireStep(step: OnboardingStep): OnboardingStep {
  const patch = AR_ATHLETE_STEP_LOCALE[step.id] ?? FLOW_EXTRA_AR[step.id];
  return patchStep(step, patch);
}
