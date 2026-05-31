import type { StepLocalePatch } from './localizeAthleteSteps';

/** Egyptian colloquial (عامية) — chat copy is playful / comedic */
export const AR_ATHLETE_STEP_LOCALE: Record<string, StepLocalePatch> = {
  programIntro: {
    title: 'برنامج القوة',
    subtitle: 'مصمم لك على تكوين',
    body: 'هنظبطلك التمرين والأكل والراحة على مزاجك — من غير كلام فاضي.',
    cta: 'يلا بينا',
  },

  displayName: {
    title: 'اسمك إيه؟',
    chatMessage:
      'يلااا بينا 🔥\nأنا الكوتش — مش هعورك، بس هطلعك في شكل.\nاسمك إيه علشان أناديك صح؟',
    placeholder: 'اكتب اسمك هنا',
  },

  address: {
    title: 'عنوانك فين؟',
    chatMessage: 'لو حابب، ابعت عنوانك — مش هنبعت لك بيتزا، بس للملف 😂',
    placeholder: 'الشارع، العمارة، الشقة',
  },

  city: {
    title: 'ساكن فين؟',
    chatMessage: 'في أنهي مدينة؟\nعشان نعرف الجو حر ولا ساقع زي القاهرة 😅',
    placeholder: 'مثال: القاهرة',
  },

  phone: {
    title: 'رقم موبايلك؟',
    chatMessage: 'رقمك كام؟\nمش هنكلمك الساعة ٦ الصبح... إلا لو نسيت تمرين 😴',
    placeholder: '+20 100 000 0000',
  },

  ageRange: {
    title: 'سنّك في أنهي رينج؟',
    subtitle: 'هنظبط الشدة على مرحلتك — من غير ما نحكم.',
    options: {
      '18-29': { label: 'من 18 لـ 29' },
      '30-39': { label: 'من 30 لـ 39' },
      '40-49': { label: 'من 40 لـ 49' },
      '50+': { label: '50+' },
    },
  },

  gender: {
    title: 'انت ولد ولا بنت؟',
    subtitle: 'علشان البرنامج يبقى على مزاجك.',
    chatMessage: 'امممم interesting…\nدلوقتي قولي: انت ولد ولا بنت؟\n(مش للفضول — للبرنامج بس 😅)',
    options: {
      Male: { label: 'ولد' },
      Female: { label: 'بنت' },
    },
  },

  primaryGoal: {
    title: 'عايز توصل لإيه؟',
    chatMessage:
      'إيه اللي في دماغك؟ 💭\nعايز تبني عضل، تطلع السلم براحتك،\nولا علشان فورمة ساحل؟',
    options: {
      'Build Muscle': { label: 'تبني عضل', description: 'حجم وقوة — مش بس صورة' },
      'Lose Weight': { label: 'أخسّ', description: 'دهون أقل وجسم أنحف' },
      'Improve Endurance': { label: 'تطلع السلم براحتك', description: 'مش أتقطع بعد ٣ درجات' },
      'Stay Healthy': { label: 'فورمة ساحل', description: 'طاقة ونوم ومزاج' },
    },
  },

  goalProof: {
    title: 'لحد ٣٥٪ أقوى في ٣ شهور',
    body: 'اللي بيمشي على خطة بيلاقي فرق — مش بس كلام في الكومنتات 😂',
    cta: 'ابني خطتي',
  },

  goalLikert: {
    title: 'ده ينطبق عليك؟',
    statement: 'عايز خطة تزق معايا لما أقوى — مش تثبتني في مكاني.',
  },

  physique: {
    title: 'عايز شكل إيه؟',
    chatMessage: 'عايز توصل لشكل إيه؟\nنحيف رياضي، عضلات، ولا shredded زي إعلان البروتين؟ 😎',
    options: {
      Lean: { label: 'نحيف ومحدد', description: 'رياضي من غير تضخم' },
      Muscular: { label: 'عضلات', description: 'كتلة واضحة' },
      Ripped: { label: 'مشدود جداً', description: 'دهون قليلة — dedication' },
    },
  },

  successMetrics: {
    title: 'هتعرف إنك نجحت إزاي؟',
    subtitle: 'اختار لحد ٣',
    chatMessage: 'إيه اللي يخليك تحس إنك كسبت؟\nالميزان، المرآة، ولا لما ترفع أثقل من صاحبك؟ 😂',
    options: {
      muscle_gain: { label: 'عضلات أكتر', description: 'حجم وكتلة' },
      strength: { label: 'قوة أكتر', description: 'أوزان أتقل' },
      endurance: { label: 'تحمّل', description: 'مش أتقطع بسرعة' },
      weight_loss: { label: 'وزن أقل', description: 'رقم الميزان ينزل' },
      measurements: { label: 'مقاسات', description: 'الشكل يتغير' },
      wellbeing: { label: 'حسّ كويس', description: 'طاقة ومزاج' },
    },
  },

  bodyFocus: {
    title: 'تركّز على إيه في جسمك؟',
    subtitle: 'اختار كل اللي ينطبق عليك',
    chatMessage: 'عايز نركّز على أنهي حتة؟\nولا الجسم كله — من غير تفضيلات غريبة 😄',
    options: {
      full_body: { label: 'الجسم كله' },
      shoulders: { label: 'كتاف' },
      biceps: { label: 'إيد / بايسبس' },
      back: { label: 'ضهر' },
      chest: { label: 'صدر' },
      core: { label: 'بطن / كور' },
      glutes: { label: 'مؤخرة' },
      legs: { label: 'رجلين' },
    },
  },

  trackProgress: {
    title: 'هتتابع تقدّمك إزاي؟',
    chatMessage: 'عايز تعرف إنك بتتحسّن إزاي؟\nأوزان، تكرارات، ولا لما التيشرت يبقى أوسع؟ 👕',
    options: {
      heavier_weights: { label: 'أوزان أتقل', description: 'كل أسبوع حاجة جديدة' },
      milestones: { label: 'أرقام قياسية', description: 'PBs شخصية' },
      reps: { label: 'تكرارات أكتر', description: 'نفس الوزن، جودة أحسن' },
      compounds: { label: 'تمارين أساسية', description: 'سكوات، ديدليفت، بنش' },
    },
  },

  feelings: {
    title: 'عايز تحسّ بإيه؟',
    chatMessage: 'بعد ما تتمرّن، عايز تحسّ بإيه؟\nطاقة، ثقة، راحة، ولا إنك عملت حاجة النهارده؟',
    options: {
      energized: { label: 'طاقة', description: 'نشاط أكتر' },
      confident: { label: 'ثقة', description: 'مش خايف من المراية' },
      relaxed: { label: 'راحة', description: 'ضغط أقل' },
      accomplished: { label: 'إنجاز', description: 'حسّ إني عملت حاجة' },
    },
  },

  workoutLocation: {
    title: 'بتمرّن فين؟',
    chatMessage: 'بتتمرن فين؟',
    options: {
      Home: { label: 'في البيت', description: 'بوزن جسم أو حاجات بسيطة' },
      Gym: { label: 'في الجيم', description: 'أوزان وأجهزة' },
      Mixed: { label: 'الاتنين', description: 'بيت + جيم' },
    },
  },

  addCardio: {
    title: 'نضيف كارديو؟',
    chatMessage: 'نحط كارديو في الخطة؟\nولا بس أوزان وخلاص — من غير جري ورا الباص؟ 🏃',
    options: {
      yes: { label: 'أيوه' },
      no: { label: 'لأ، مش دلوقتي' },
    },
  },

  equipment: {
    title: 'عندك إيه في الجيم؟',
    chatMessage: 'إيه الأجهزة المتاحة عندك؟\nاختار اللي تقدر تستخدمه — مش اللي بس في الإعلان.',
    options: {
      treadmill: { label: 'مشاية' },
      bike: { label: 'عجلة ثابتة' },
      assault_bike: { label: 'Assault bike' },
      elliptical: { label: 'إليبتيكال' },
      stepper: { label: 'سلالم' },
      rower: { label: 'تجديف' },
    },
  },

  workoutTime: {
    title: 'بتمرّن إمتى؟',
    chatMessage: 'بتفضّل تمرّن إمتى؟\nصبح — قبل الشغل والزحمة، ولا بليل بعد ما العالم تنام؟',
    options: {
      morning: { label: 'الصبح' },
      afternoon: { label: 'الضهر' },
      evening: { label: 'بالليل' },
      varies: { label: 'على حسب اليوم' },
    },
  },

  workoutDuration: {
    title: 'التمرينة تاخد قد إيه؟',
    chatMessage: 'كل تمرينة تقدر تخصّص لها قد إيه؟\nمن غير ما تقول "ساعة" وانت بتعمل ٣ تمارين 😂',
    options: {
      '30': { label: 'حوالي ٣٠ دقيقة' },
      '45': { label: 'حوالي ٤٥ دقيقة' },
      '60': { label: 'ساعة كده' },
      '90': { label: 'أكتر من ساعة' },
    },
  },

  otherSports: {
    title: 'رياضات تانية؟',
    chatMessage: 'بتعمل حاجة تانية غير الجيم؟\nكورة، يوغا، ولا بس مشي للفرن؟',
    options: {
      cardio: { label: 'كارديو', description: 'جري، عجلة، تجديف' },
      other: { label: 'أخرى', description: 'اكتب الرياضة' },
      martial: { label: 'فنون قتالية' },
      team: { label: 'رياضات جماعية' },
      none: { label: 'بدون رياضات' },
    },
  },

  bodyType: {
    title: 'جسمك شكله إيه؟',
    chatMessage:
      'جسمك أقرب لإيه؟\nنحيف ياكل ومش يكبر، رياضي، ولا بيخزّن على طول زي الفريزر؟ 😂',
    options: {
      ectomorph: { label: 'نحيف', description: 'صعب يكبر' },
      mesomorph: { label: 'رياضي', description: 'عضلات بسرعة' },
      endomorph: { label: 'بيتخزّن', description: 'دهون بسهولة' },
    },
  },

  bodyFat: {
    title: 'نسبة الدهون تقريباً؟',
    chatMessage:
      'اختار الشكل الأقرب لجسمك من الصور.\nمن غير حكم متقلقش — بس عشان نعرف نبدأ منين',
    levels: {
      '5-9': '5–9٪',
      '10-14': '10–14٪',
      '15-19': '15–19٪',
      '20-24': '20–24٪',
      '25-29': '25–29٪',
      '30-34': '30–34٪',
      '35+': '35٪+',
    },
  },

  height: {
    title: 'طولك كام؟',
    chatMessage: 'طولك قد إيه؟\nبالسنتي — مش بالمتر زي ما بنقول في العيادة 😂',
    placeholder: '175',
  },

  weight: {
    title: 'وزنك كام؟',
    chatMessage: 'وزنك كام؟\nالميزان مش خصمك — إحنا هنظبطه 💪',
    placeholder: '75',
  },

  targetWeight: {
    title: 'عايز توصل لكم؟',
    chatMessage:
      'تماااااام! قولي بقى الوزن الي انت عايز توصله علشان الخطة هتمشي على هدفك — مش على ضميرك.',
    placeholder: '80',
  },

  age: {
    title: 'عندك كام سنة؟',
    chatMessage: 'عندك كام سنة بقى؟\nمتخافش مش هحكم عليك 😂',
    placeholder: '25',
  },

  fitnessLevel: {
    title: 'مستواك إيه؟',
    chatMessage:
      'تشوف نفسك في أنهي مستوى؟\nمبتدئ، في النص، ولا بتتمرّن من زمان الأيام الحلوة؟',
    encouragement:
      'كمان حبه خلاص و هنكون خلصنا — عارف اني زهقتك زي ما بتكون عايز تنام وحد بيكلمك ف التليفون 😉 😇',
    options: {
      Beginner: { label: 'مبتدئ', description: 'جديد أو رجعت بعد فترة' },
      Intermediate: { label: 'في النص', description: 'بتمارّن على طول' },
      Advanced: { label: 'متقدّم', description: 'سنين تمرين' },
    },
  },

  pastTraining: {
    title: 'جربت إيه قبل كده؟',
    chatMessage: 'جربت حاجة من دول قبل كده؟\nكوتش، أبليكيشن، يوتيوب، ولا "هعلّم نفسي"؟',
    options: {
      trainer: { label: 'كوتش شخصي' },
      apps: { label: 'أبليكيشنات' },
      videos: { label: 'فيديوهات' },
      self: { label: 'لوحدي' },
      none: { label: 'ولا حاجة' },
    },
  },

  injuries: {
    title: 'في حاجة بتوجعك؟',
    subtitle: 'اختار كل اللي ينطبق عليك',
    chatMessage:
      'في حاجة بتوجعك؟ ظهر، ركبة، كتف...\nقول بصراحة — هنعدّل التمارين، مش هنحكم عليك.',
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
      none: { label: 'لا، كله تمام' },
    },
  },

  pastActivities: {
    title: 'جربت إيه لشكل جسمك؟',
    chatMessage: 'عملت إيه قبل كده عشان شكلك؟\nدايت، أوزان، كارديو — قول بصراحة.',
    options: {
      nutrition: { label: 'أكل / دايت' },
      weights: { label: 'أوزان' },
      cardio: { label: 'كارديو' },
      bodyweight: { label: 'بوزن الجسم' },
      sports: { label: 'رياضات' },
    },
  },

  pushups: {
    title: 'تقدر تعمل كام ضغط؟',
    chatMessage: 'تقدر تعمل كام ضغط ورا بعض؟\nمن غير ما تقول "كتير" — رقم 😂',
    options: {
      lt12: { label: 'أقل من 12' },
      '13-20': { label: '13–20' },
      gt20: { label: 'أكتر من 20' },
      unknown: { label: 'مش عارف' },
    },
  },

  squats: {
    title: 'تقدر تعمل كام سكوات؟',
    chatMessage: 'وسكوات؟ كام واحدة تقدر من غير ما تتكسّر؟ 😅',
    options: {
      lt12: { label: 'أقل من 12' },
      '13-20': { label: '13–20' },
      gt20: { label: 'أكتر من 20' },
      unknown: { label: 'مش عارف' },
    },
  },

  deadliftMax: {
    title: 'أقصى ديدليفت؟',
    chatMessage: 'في الديدليفت، أقصى وزن رفعته كام؟\nلو مش متأكد، قدّر — من غير بطلنة.',
  },

  benchMax: {
    title: 'أقصى بنش بريس؟',
    chatMessage: 'وبالنسبة لضغط الصدر — أقصى وزن رفعته؟',
  },

  fitnessSummary: {
    title: 'مستوى لياقتك',
  },

  exerciseAttitude: {
    title: 'التمرين بالنسبة لك؟',
    chatMessage: 'التمرين عندك معناه إيه؟\nواجب، مزعج، ولا أحلى جزء في اليوم؟',
    options: {
      necessary: { label: 'لازم', description: 'جزء من الروتين' },
      inconvenient: { label: 'مزعج', description: 'صعب ألاقي وقت' },
      enjoyable: { label: 'حلو', description: 'بستناه' },
    },
  },

  eatingHabits: {
    title: 'أكلك عامل إزاي؟',
    subtitle: 'اختار كل اللي ينطبق عليك',
    chatMessage: 'بتاكل ليه غالباً؟\nممكن تختار أكتر من واحد — جوع، ملل، عادة، ولا "عشان أعيش"؟ 😂',
    options: {
      emotional: { label: 'أكل عاطفي' },
      bored: { label: 'من الملل' },
      unconscious: { label: 'من غير وعي' },
      habitual: { label: 'عادة' },
      energy: { label: 'طاقة' },
    },
  },

  stressCoping: {
    title: 'التوتر بتتعامل معاه إزاي؟',
    chatMessage: 'لما تتوتر بتعمل إيه؟\nتمرين، أكل، ولا تخرج تتمشى؟',
    options: {
      exercise: { label: 'تمرين' },
      creative: { label: 'حاجة إبداعية' },
      outdoors: { label: 'برة' },
      eating: { label: 'أكل أكتر/أقل' },
    },
  },

  sleep: {
    title: 'بتنام قد إيه؟',
    chatMessage: 'بتنام كام ساعة؟\n٥ ساعات ولا ٨ — من غير ما تقول "كفاية" 😴',
    options: {
      lt5: { label: 'أقل من 5' },
      '5-6': { label: '5–6' },
      '7-8': { label: '7–8' },
      gt8: { label: 'أكتر من 8' },
    },
  },

  walking: {
    title: 'بتمشي قد إيه؟',
    chatMessage: 'بتمشي قد إيه في اليوم؟\nمن السرير للتلاجة مش محسوبة 😂',
    options: {
      lt1: { label: 'أقل من ساعة' },
      '1-2': { label: '1–2 ساعة' },
      gt2: { label: 'أكتر من ساعتين' },
    },
  },

  water: {
    title: 'بتشرب مية قد إيه؟',
    chatMessage: 'مية؟ ولا قهوة وشاي بس؟ ☕\nاختار اللي بيمثّلك.',
    options: {
      coffee: { label: 'قهوة/شاي أكتر' },
      lt2: { label: 'أقل من كوبين' },
      '2-6': { label: '2–6 أكواب' },
      '7-10': { label: '7–10 أكواب' },
      gt10: { label: 'أكتر من 10' },
    },
  },

  diet: {
    title: 'قيود على الأكل؟',
    chatMessage: 'في حاجة ممنوعة عليك في الأكل؟\nنباتي، لاكتوز، مكسرات — قول.',
    options: {
      none: { label: 'لا' },
      vegetarian: { label: 'نباتي' },
      gluten: { label: 'بدون جلوتين' },
      lactose: { label: 'بدون لاكتوز' },
      nuts: { label: 'حساسية مكسرات' },
    },
  },

  tracker: {
    title: 'عندك ساعة أو تطبيق؟',
    chatMessage: 'بتستخدم ساعة ذكية أو أبليكيشن تتبع؟\nولا بس "حاسس إني اتمرّنت"؟',
    options: {
      yes: { label: 'أيوه' },
      no: { label: 'لأ' },
    },
  },

  planFailed: {
    title: 'خطط قبل كده فشلت؟',
    chatMessage: 'جربت خطط قبل كده ومشيتش؟\nمش هنحكم — بس عشان نعرف نعمل إيه مختلف.',
    options: {
      yes: { label: 'أيوه' },
      no: { label: 'لأ' },
    },
  },

  stayOnTrack: {
    title: 'تكوين يفكّك على الاستمرار',
    body: 'الجدول والأكل والتعافي ممكن يعطّلوك — إحنا هنا نفكّك عليك.',
    cta: 'كمل',
  },

  motivation: {
    title: 'إيه اللي خلّاك تبدأ؟',
    subtitle: 'اختار اللي ينطبق',
    chatMessage: 'إيه اللي خلّاك تقول "يلا نبدأ"؟\nالمراية، الميزان، الصحة، ولا التيشرت ضاق؟ 👕',
    options: {
      visual: { label: 'شكل / مراية', description: 'ميزان وقياسات' },
      fitness: { label: 'لياقتي ضعيفة', description: 'عايز أتحسّن' },
      health: { label: 'صحتي' },
      clothing: { label: 'الهدوم' },
      aging: { label: 'السن' },
    },
  },

  upcomingEvent: {
    title: 'مناسبة قريبة؟',
    chatMessage: 'في مناسبة قريبة؟\nفرح، سفر، عيد ميلاد — ولا مفيش حاجة؟',
    options: {
      vacation: { label: 'سفر / أجازة' },
      wedding: { label: 'فرح' },
      birthday: { label: 'عيد ميلاد' },
      none: { label: 'مفيش' },
    },
  },

  supportLikert: {
    title: 'موافق على الكلام ده؟',
    statement: 'لما حد يشجّعني في التمرين، بحسّ إني هكمل أكتر.',
  },

  confidence: {
    title: 'واثق إنك هتوصل؟',
    chatMessage: 'واثق إنك هتوصل للهدف؟\nمن غير ما تقول "إن شاء الله" بس 😂',
    options: {
      high: { label: 'أيوه جداً', description: 'هوصل' },
      reasonable: { label: 'معقول', description: 'فرصة كويسة' },
      optimistic: { label: 'متفائل', description: 'يا ريت' },
      low: { label: 'مش أوي', description: 'عندي شك' },
    },
  },

  generating: {
    title: 'استنى شوية… بنجهّز خطتك 🔧',
  },

  pace: {
    title: 'خطتك جاهزة! 🎉',
    subtitle: 'عايز توصل بسرعة إيه؟',
    chatMessage: 'عايزها بسرعة، على مهل، ولا في النص — زي الأكل بعد التمرين؟ 😂',
    options: {
      fast: { label: 'بسرعة' },
      steady: { label: 'على مهل' },
      balanced: { label: 'في النص' },
    },
  },
};
