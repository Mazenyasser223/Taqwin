import type { TranslationKey } from '../../lib/i18n/translations';

export type EquipmentGroupId =
  | 'free-weights'
  | 'machines-cables'
  | 'bodyweight-bands'
  | 'accessories'
  | 'mobility'
  | 'cardio'
  | 'other';

export type EquipmentGroupDef = {
  id: EquipmentGroupId;
  categories: string[];
  icon: string;
  tileClass: string;
  translationKey: TranslationKey;
};

export const EQUIPMENT_GROUPS: EquipmentGroupDef[] = [
  {
    id: 'free-weights',
    categories: ['barbell', 'dumbbells', 'kettlebells', 'plate'],
    icon: 'fitness_center',
    tileClass: 'from-orange-600/80 via-amber-700/60 to-stone-900/90',
    translationKey: 'exercises.group.freeWeights',
  },
  {
    id: 'machines-cables',
    categories: ['machine', 'cables', 'smith-machine'],
    icon: 'settings',
    tileClass: 'from-slate-600/80 via-zinc-700/60 to-stone-900/90',
    translationKey: 'exercises.group.machinesCables',
  },
  {
    id: 'bodyweight-bands',
    categories: ['bodyweight', 'band', 'trx'],
    icon: 'accessibility_new',
    tileClass: 'from-emerald-600/80 via-teal-700/60 to-stone-900/90',
    translationKey: 'exercises.group.bodyweightBands',
  },
  {
    id: 'accessories',
    categories: ['medicine-ball', 'medicineball', 'bosu-ball', 'vitruvian'],
    icon: 'sports_gymnastics',
    tileClass: 'from-violet-600/80 via-purple-700/60 to-stone-900/90',
    translationKey: 'exercises.group.accessories',
  },
  {
    id: 'mobility',
    categories: ['yoga', 'pilates', 'stretches', 'recovery'],
    icon: 'self_improvement',
    tileClass: 'from-sky-600/80 via-cyan-700/60 to-stone-900/90',
    translationKey: 'exercises.group.mobility',
  },
  {
    id: 'cardio',
    categories: ['cardio'],
    icon: 'directions_run',
    tileClass: 'from-rose-600/80 via-red-700/60 to-stone-900/90',
    translationKey: 'exercises.group.cardio',
  },
];

const GROUP_BY_ID = Object.fromEntries(EQUIPMENT_GROUPS.map((g) => [g.id, g])) as Record<
  EquipmentGroupId,
  EquipmentGroupDef
>;

export function categoriesForEquipmentGroup(groupId: string): string[] {
  return GROUP_BY_ID[groupId as EquipmentGroupId]?.categories ?? [];
}

export function allKnownEquipmentCategories(): string[] {
  return EQUIPMENT_GROUPS.flatMap((g) => g.categories);
}

export function equipmentGroupKey(groupId: string): TranslationKey {
  const def = GROUP_BY_ID[groupId as EquipmentGroupId];
  return def?.translationKey ?? 'exercises.group.other';
}

export type BrowseSelection =
  | { kind: 'muscle'; id: string }
  | { kind: 'equipment'; id: EquipmentGroupId };
