import type { AppLanguage } from '../../services/settingsService';

type ExerciseNameFields = {
  name: string;
  nameAr?: string | null;
  displayName?: string | null;
};

/** Prefer API displayName, then nameAr when UI is Arabic. */
function coerceExerciseNameField(name: ExerciseNameFields['name']): string {
  if (typeof name === 'string') return name;
  if (name && typeof name === 'object') {
    const o = name as Record<string, unknown>;
    for (const key of ['displayName', 'nameEn', 'name', 'nameAr', 'label']) {
      const v = o[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return 'Exercise';
}

export function resolveExerciseDisplayName(
  exercise: ExerciseNameFields,
  language: AppLanguage,
): string {
  const name = coerceExerciseNameField(exercise.name);
  if (exercise.displayName?.trim()) return exercise.displayName.trim();
  if (language === 'ar' && exercise.nameAr?.trim()) return exercise.nameAr.trim();
  if (language === 'ar') {
    const ar = COMMON_EXERCISE_AR[name];
    if (ar) return ar;
  }
  return name;
}

/** MuscleWiki primary_muscle labels → Arabic (common labels). */
const MUSCLE_LABEL_AR: Record<string, string> = {
  Chest: 'صدر',
  'Upper Pectoralis': 'صدر علوي',
  'Mid and Lower Chest': 'صدر أوسط وسفلي',
  Lats: 'عضلة ظهرية عريضة',
  'Mid back': 'منتصف الظهر',
  'Lower back': 'أسفل الظهر',
  Traps: 'ترapes',
  'Lower Traps': 'ترapes سفلي',
  'Traps (mid-back)': 'ترapes',
  'Upper Traps': 'ترapes علوي',
  Shoulders: 'أكتاف',
  'Anterior Deltoid': 'دالية أمامية',
  'Lateral Deltoid': 'دالية جانبية',
  'Posterior Deltoid': 'دالية خلفية',
  'Front Shoulders': 'أكتاف أمامية',
  'Rear Shoulders': 'أكتاف خلفية',
  Biceps: 'بايسبس',
  'Long Head Bicep': 'بايسبس رأس طويل',
  'Short Head Bicep': 'بايسبس رأس قصير',
  Triceps: 'ترايسبس',
  'Long Head Tricep': 'ترايسبس رأس طويل',
  Forearms: 'ساعد',
  'Wrist Extensors': 'باسطات المعصم',
  'Wrist Flexors': 'ثنايا المعصم',
  Abdominals: 'بطن',
  'Upper Abdominals': 'بطن علوي',
  'Lower Abdominals': 'بطن سفلي',
  Obliques: 'عضلات مائلة',
  Quads: 'أمام الفخذ',
  'Rectus Femoris': 'فخذ أمامي',
  'Inner Quadriceps': 'فخذ داخلي',
  'Outer Quadricep': 'فخذ خارجي',
  Hamstrings: 'خلف الفخذ',
  'Lateral Hamstrings': 'خلف فخذ جانبي',
  'Medial Hamstrings': 'خلف فخذ داخلي',
  Calves: 'سمانة',
  Gastrocnemius: 'عضلة السمانة',
  Soleus: 'العضلة الساقية',
  Tibialis: 'قصبة',
  Glutes: 'مؤخرة',
  'Gluteus Maximus': 'أكبر عضلة ألوية',
  'Gluteus Medius': 'وسط ألوية',
};

export function localizeMuscleLabel(label: string, language: AppLanguage): string {
  if (language !== 'ar') return label;
  return MUSCLE_LABEL_AR[label] ?? label;
}

const DIFFICULTY_AR: Record<string, string> = {
  Beginner: 'مبتدئ',
  Intermediate: 'متوسط',
  Advanced: 'متقدم',
  Novice: 'مبتدئ',
  Expert: 'خبير',
};

/** Common exercises shown on the home dashboard plan (fallback list). */
const COMMON_EXERCISE_AR: Record<string, string> = {
  'Bench Press': 'ضغط البنش',
  'Overhead Press': 'ضغط كتف',
  'Incline Dumbbell Press': 'ضغط دамбل مائل',
  'Lat Pulldown': 'سحب علوي',
  'Barbell Row': 'تجديف بار',
  'Face Pull': 'سحب وجه',
  'Back Squat': 'قرفصاء خلفي',
  'Squats': 'قرفصاء',
  'Romanian Deadlift': 'رفعة رومانية',
  'Walking Lunges': 'اندفاعات',
  'Lateral Raise': 'رفع جانبي',
  'Leg Press': 'ضغط رجل',
  'Leg Curl': 'ثني رجل',
  'Deadlifts': 'رفعة ميتة',
  'Treadmill / Cardio': 'مشي / كارديو',
  'Bike Intervals': 'دراجة فواصل',
  'Core Circuit': 'دائرة بطن',
};

export function localizeDifficultyLabel(difficulty: string | null | undefined, language: AppLanguage): string {
  if (!difficulty) return '';
  if (language !== 'ar') return difficulty;
  return DIFFICULTY_AR[difficulty] ?? difficulty;
}
