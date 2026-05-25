/** Arabic questionnaire catalog — idempotent upsert by (flow, stepId). */
const ONBOARDING_QUESTION_CATALOG = [
  // ── Core (17) ──
  { flow: 'core', stepId: 'displayName', sortOrder: 1, titleAr: 'ما اسمك؟', reasonAr: 'أول شيء يبني علاقة مع الكوتش؛ خفيف ولا يحتاج تفكير.' },
  { flow: 'core', stepId: 'gender', sortOrder: 2, titleAr: 'ما جنسك؟', reasonAr: 'يخصّص البرنامج واللغة والصور؛ مرتبط بالهوية مباشرة بعد الاسم.' },
  { flow: 'core', stepId: 'age', sortOrder: 3, titleAr: 'كم عمرك؟', reasonAr: 'يحدد شدة التمرين والتعافي؛ رقم بسيط قبل القياسات الجسدية.' },
  { flow: 'core', stepId: 'phone', sortOrder: 4, titleAr: 'ما رقم موبايلك؟', reasonAr: 'تواصل وتحقق الحساب؛ بعد الثقة الأولية، قبل الأسئلة الطويلة.' },
  { flow: 'core', stepId: 'height', sortOrder: 5, titleAr: 'ما طولك؟', reasonAr: 'أساس حساب BMI والسعرات؛ يبدأ «كتلة الجسم» بقياس ثابت.' },
  { flow: 'core', stepId: 'weight', sortOrder: 6, titleAr: 'ما وزنك الحالي؟', reasonAr: 'يكمل الطول لصورة الجسم الحالية قبل الشكل والهدف.' },
  { flow: 'core', stepId: 'bodyType', sortOrder: 7, titleAr: 'ما نوع جسمك؟', reasonAr: 'يفسّر سرعة التقدم (نحيف/رياضي/يخزّن) بعد الأرقام.' },
  { flow: 'core', stepId: 'bodyMeasurements', sortOrder: 8, titleAr: 'قياسات الجسم (محيطات)', reasonAr: 'تفصيل اختياري بعد الوزن/الطول؛ لمن يهتم بالتتبع الدقيق.' },
  { flow: 'core', stepId: 'primaryGoal', sortOrder: 9, titleAr: 'ما هدفك الرئيسي؟', reasonAr: 'بعد فهم الجسم نربط «لماذا أنت هنا» — يوجّه كل ما يلي.' },
  { flow: 'core', stepId: 'activityLevel', sortOrder: 10, titleAr: 'مستوى نشاطك اليومي', reasonAr: 'يفرّق بين «جالس طول اليوم» و«نشيط» لتقدير السعرات والتعافي.' },
  { flow: 'core', stepId: 'fitnessLevel', sortOrder: 11, titleAr: 'مستواك التدريبي', reasonAr: 'خبرة التمرين وليس النشاط اليومي؛ يحدد صعوبة الخطة.' },
  { flow: 'core', stepId: 'lastTraining', sortOrder: 12, titleAr: 'آخر تمرين / خلفيتك', reasonAr: 'يوضح إنك مبتدئ حقيقي أم راجع بعد فترة.' },
  { flow: 'core', stepId: 'otherSports', sortOrder: 13, titleAr: 'رياضات أخرى', reasonAr: 'تؤثر على التعافي والجدول؛ بعد صورة اللياقة العامة.' },
  { flow: 'core', stepId: 'upcomingEvent', sortOrder: 14, titleAr: 'مناسبة قريبة؟', reasonAr: 'ضغط زمني على الهدف (٣–٦ أشهر) قبل أسئلة أثقل.' },
  { flow: 'core', stepId: 'planFailed', sortOrder: 15, titleAr: 'هل فشلت خطط من قبل؟', reasonAr: 'مؤشر الالتزام؛ مهم للكوتش لكن ليس أول سؤال (حساس).' },
  { flow: 'core', stepId: 'inbodyScan', sortOrder: 16, titleAr: 'InBody', reasonAr: 'قياس موضوعي؛ بعد الأساسيات، وقبل/مع الصور.' },
  { flow: 'core', stepId: 'progressPhotos', sortOrder: 17, titleAr: 'صور أمام وخلف', reasonAr: 'تحتاج راحة ووقت؛ في آخر القسم بعد كل الأرقام.' },

  // ── Workout (22) ──
  { flow: 'workout', stepId: 'injuries', sortOrder: 1, titleAr: 'إصابات؟', reasonAr: 'أولاً للأمان — كل التمارين تُبنى حول ما يجب تجنبه.' },
  { flow: 'workout', stepId: 'goal12Week', sortOrder: 2, titleAr: 'هدف ١٢ أسبوعاً', reasonAr: 'يحدد اتجاه الجدول بعد معرفة القيود الطبية.' },
  { flow: 'workout', stepId: 'bodyFocus', sortOrder: 3, titleAr: 'مناطق التركيز', reasonAr: 'يخصّص التمارين داخل هدف الـ ١٢ أسبوع.' },
  { flow: 'workout', stepId: 'trainingDaysPerWeek', sortOrder: 4, titleAr: 'أيام التمرين/أسبوع', reasonAr: 'يحدد الحجم (٣ vs ٥ أيام) قبل المكان والوقت.' },
  { flow: 'workout', stepId: 'workoutLocation', sortOrder: 5, titleAr: 'مكان التمرين', reasonAr: 'بيت/جيم يغيّر نوع التمارين بالكامل.' },
  { flow: 'workout', stepId: 'gymLink', sortOrder: 6, titleAr: 'ربط الصالة (إن جيم)', reasonAr: 'يعتمد على اختيار «جيم» في السطر السابق.' },
  { flow: 'workout', stepId: 'workoutTime', sortOrder: 7, titleAr: 'وقت التمرين المفضل', reasonAr: 'يرتبط بالجدول اليومي بعد معرفة الأيام والمكان.' },
  { flow: 'workout', stepId: 'workoutDuration', sortOrder: 8, titleAr: 'مدة التمرينة', reasonAr: 'يحدد حجم كل جلسة بعد معرفة متى تتمرن.' },
  { flow: 'workout', stepId: 'preferredSplit', sortOrder: 9, titleAr: 'تقسيمة/جدول معين؟', reasonAr: 'تفضيل هيكل الأسبوع بعد معرفة الوقت والمدة.' },
  { flow: 'workout', stepId: 'exercisesAvoid', sortOrder: 10, titleAr: 'تمارين ممنوعة', reasonAr: 'قيود شخصية قبل اختبار القوة.' },
  { flow: 'workout', stepId: 'exercisesLove', sortOrder: 11, titleAr: 'تمارين مفضلة', reasonAr: 'نضيف ما يحبه بعد ما استبعدنا ما يكرهه.' },
  { flow: 'workout', stepId: 'pushups', sortOrder: 12, titleAr: 'ضغط', reasonAr: 'اختبارات بسيطة بدون معدات.' },
  { flow: 'workout', stepId: 'squats', sortOrder: 13, titleAr: 'سكوات', reasonAr: 'يكمل صورة الجسم العلوي/السفلي.' },
  { flow: 'workout', stepId: 'pullups', sortOrder: 14, titleAr: 'عقلة', reasonAr: 'يقيّم قوة السحب (غالباً أصعب من الضغط).' },
  { flow: 'workout', stepId: 'benchMax', sortOrder: 15, titleAr: 'بنش (اختياري)', reasonAr: 'يحتاج جيم/بار؛ بعد تمارين وزن الجسم.' },
  { flow: 'workout', stepId: 'deadliftMax', sortOrder: 16, titleAr: 'ديدليفت (اختياري)', reasonAr: 'تقييم متقدم؛ آخر الاختبارات الاختيارية.' },
  { flow: 'workout', stepId: 'addCardio', sortOrder: 17, titleAr: 'إضافة كارديو؟', reasonAr: 'قرار عام قبل تفاصيل الأجهزة.' },
  { flow: 'workout', stepId: 'equipment', sortOrder: 18, titleAr: 'أجهزة كارديو', reasonAr: 'فقط إن قال نعم — لا نزعج من لا يريد كارديو.' },
  { flow: 'workout', stepId: 'strengthEquipment', sortOrder: 19, titleAr: 'معدات القوة', reasonAr: 'تفصيل الجيم بعد الكارديو؛ لبناء الجدول النهائي.' },
  { flow: 'workout', stepId: 'goal12WeekPace', sortOrder: 20, titleAr: 'شدة الهدف لـ ١٢ أسبوع', reasonAr: 'بدونها الـ AI يخمّن حجم التقدم (سريع / متوازن / هادئ).' },
  { flow: 'workout', stepId: 'restDaysPreference', sortOrder: 21, titleAr: 'أيام راحة ثابتة؟', reasonAr: 'يمنع جدول ٦ أيام لمن لا يتحمل — أو «الكوتش يحدد».' },
  { flow: 'workout', stepId: 'liftExperience', sortOrder: 22, titleAr: 'خبرة بتمارين معينة', reasonAr: 'الأرقام لوحدها مش كفاية (مثلاً: أول مرة ديدليفت؟).' },

  // ── Diet (19 + extras from spec) ──
  { flow: 'diet', stepId: 'foodAllergies', sortOrder: 1, titleAr: 'حساسية أكل؟', reasonAr: 'قيود صحية أولاً — لا نعرض أصلاً ما يضرّه.' },
  { flow: 'diet', stepId: 'foodsExcluded', sortOrder: 2, titleAr: 'أكل مرفوض نهائياً؟', reasonAr: 'تفضيل شخصي بعد الحساسية الطبية.' },
  { flow: 'diet', stepId: 'dietType', sortOrder: 3, titleAr: 'نوع الدايت', reasonAr: 'إطار عام (هاي بروتين، لو كارب…) بعد القيود.' },
  { flow: 'diet', stepId: 'mealPlanStyle', sortOrder: 4, titleAr: 'ثابت أسبوعي أم متغير يومياً؟', reasonAr: 'شكل الخطة قبل عدد الوجبات والمكونات.' },
  { flow: 'diet', stepId: 'mealsPerDay', sortOrder: 5, titleAr: 'عدد الوجبات', reasonAr: 'يحدد توزيع السعرات بعد نوع الدايت.' },
  { flow: 'diet', stepId: 'targetWeight', sortOrder: 6, titleAr: 'الوزن المستهدف', reasonAr: 'رقم الهدف الغذائي بعد هيكل الوجبات.' },
  { flow: 'diet', stepId: 'proteinPrefs', sortOrder: 7, titleAr: 'بروتينات مفضلة', reasonAr: 'بناء القائمة يبدأ بالبروتين (أساس العضلات).' },
  { flow: 'diet', stepId: 'carbPrefs', sortOrder: 8, titleAr: 'كارب مفضل', reasonAr: 'ثاني ماكرو للطاقة والتمرين.' },
  { flow: 'diet', stepId: 'fatPrefs', sortOrder: 9, titleAr: 'دهون صحية', reasonAr: 'يكمل الماكروز الثلاثة.' },
  { flow: 'diet', stepId: 'fruitPrefs', sortOrder: 10, titleAr: 'فواكه', reasonAr: 'تفضيلات فرعية بعد الأساسيات.' },
  { flow: 'diet', stepId: 'dairyPrefs', sortOrder: 11, titleAr: 'ألبان', reasonAr: 'نفس المستوى — تفضيلات إضافية.' },
  { flow: 'diet', stepId: 'water', sortOrder: 12, titleAr: 'شرب المية', reasonAr: 'عادة يومية عامة.' },
  { flow: 'diet', stepId: 'eatingHabits', sortOrder: 13, titleAr: 'عادات الأكل', reasonAr: 'سلوك (عاطفي، ملل…) يؤثر على الالتزام.' },
  { flow: 'diet', stepId: 'supplementsBudget', sortOrder: 14, titleAr: 'مكملات + ميزانية', reasonAr: 'آخر شيء — ليس للجميع ويعتمد على القدرة المالية.' },
  { flow: 'diet', stepId: 'foodBudget', sortOrder: 15, titleAr: 'ميزانية الأكل', reasonAr: 'يمنع خطط بسلمون كل يوم لكل الناس (منخفضة / متوسطة / عالية).' },
  { flow: 'diet', stepId: 'mealPrepTime', sortOrder: 16, titleAr: 'وقت تحضير الأكل', reasonAr: 'وجبات واقعية (٥ دقائق / ٣٠ / ساعة).' },
  { flow: 'diet', stepId: 'cookOrReady', sortOrder: 17, titleAr: 'هل تطبخ أم تأكل جاهز؟', reasonAr: 'شكل الوجبات.' },
  { flow: 'diet', stepId: 'religiousDiet', sortOrder: 18, titleAr: 'صيام ديني / رمضان / نباتي صارم', reasonAr: 'قيود ثقافية.' },
  { flow: 'diet', stepId: 'calorieTarget', sortOrder: 19, titleAr: 'هدف سعرات صريح؟', reasonAr: 'يقلل تخمين الـ AI — أو «الكوتش يحدد».' },

  // ── Wellness (8) ──
  { flow: 'wellness', stepId: 'medicalHistory', sortOrder: 1, titleAr: 'تاريخ مرضي', reasonAr: 'أوسع من «إصابة حالية» — يحتاج ثقة وتركيز.' },
  { flow: 'wellness', stepId: 'medications', sortOrder: 2, titleAr: 'أدوية حالية', reasonAr: 'تؤثر على وزن، ضغط، تمرين — بعد التشخيصات.' },
  { flow: 'wellness', stepId: 'pastInjuriesHistory', sortOrder: 3, titleAr: 'إصابات سابقة', reasonAr: 'تاريخ قد يعود؛ مختلف عن إصابات الجدول الحالي.' },
  { flow: 'wellness', stepId: 'doctorClearance', sortOrder: 4, titleAr: 'موافقة طبية', reasonAr: 'يظهر فقط إن لزم بعد معرفة الحالة.' },
  { flow: 'wellness', stepId: 'sleep', sortOrder: 5, titleAr: 'ساعات النوم', reasonAr: 'عادة يومية تؤثر على التعافي والجوع.' },
  { flow: 'wellness', stepId: 'progressTracking', sortOrder: 6, titleAr: 'كيف تلاحظ التقدم؟', reasonAr: 'أسلوبك في المتابعة (مرآة، ميزان…).' },
  { flow: 'wellness', stepId: 'hungerScale', sortOrder: 7, titleAr: 'الجوع ١–١٠', reasonAr: 'يربط المشاعر بالأكل؛ بعد الأهداف العاطفية.' },
  { flow: 'wellness', stepId: 'motivationStart', sortOrder: 8, titleAr: 'لماذا بدأت؟', reasonAr: 'دافع أساسي — يفتح المحادثة النفسية بلطف.' },
];

async function seedOnboardingQuestionCatalog(prisma) {
  for (const row of ONBOARDING_QUESTION_CATALOG) {
    await prisma.onboardingQuestionCatalog.upsert({
      where: { flow_stepId: { flow: row.flow, stepId: row.stepId } },
      create: {
        flow: row.flow,
        stepId: row.stepId,
        sortOrder: row.sortOrder,
        titleAr: row.titleAr,
        reasonAr: row.reasonAr ?? null,
        stepType: row.stepType ?? null,
        options: row.options ?? null,
      },
      update: {
        sortOrder: row.sortOrder,
        titleAr: row.titleAr,
        reasonAr: row.reasonAr ?? null,
        stepType: row.stepType ?? null,
        options: row.options ?? null,
      },
    });
  }
  console.log(`[seed] onboarding_question_catalog: ${ONBOARDING_QUESTION_CATALOG.length} rows`);
}

module.exports = { seedOnboardingQuestionCatalog, ONBOARDING_QUESTION_CATALOG };
