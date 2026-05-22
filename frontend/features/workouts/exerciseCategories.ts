import type { TranslationKey } from '../../lib/i18n/translations';

const CATEGORY_KEYS: Record<string, TranslationKey> = {
  barbell: 'exercises.cat.barbell',
  dumbbells: 'exercises.cat.dumbbells',
  bodyweight: 'exercises.cat.bodyweight',
  cables: 'exercises.cat.cables',
  kettlebells: 'exercises.cat.kettlebells',
  band: 'exercises.cat.band',
  machine: 'exercises.cat.machine',
  yoga: 'exercises.cat.yoga',
  recovery: 'exercises.cat.recovery',
  cardio: 'exercises.cat.cardio',
  plate: 'exercises.cat.plate',
  stretches: 'exercises.cat.stretches',
  pilates: 'exercises.cat.pilates',
  'smith-machine': 'exercises.cat.smithMachine',
  trx: 'exercises.cat.trx',
  'medicine-ball': 'exercises.cat.medicineBall',
  'bosu-ball': 'exercises.cat.bosuBall',
  vitruvian: 'exercises.cat.vitruvian',
  medicineball: 'exercises.cat.medicineBall',
};

export function exerciseCategoryKey(category: string): TranslationKey {
  return CATEGORY_KEYS[category] ?? 'exercises.cat.other';
}

export function formatCategoryLabel(
  category: string,
  t: (key: TranslationKey) => string,
): string {
  return t(exerciseCategoryKey(category));
}
