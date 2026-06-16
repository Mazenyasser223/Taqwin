/**
 * Equipment super-categories for exercise library browse (keep in sync with frontend exerciseCategoryGroups.ts).
 */
const EQUIPMENT_GROUPS = [
  {
    id: 'free-weights',
    categories: ['barbell', 'dumbbells', 'kettlebells', 'plate'],
  },
  {
    id: 'machines-cables',
    categories: ['machine', 'cables', 'smith-machine'],
  },
  {
    id: 'bodyweight-bands',
    categories: ['bodyweight', 'band', 'trx'],
  },
  {
    id: 'accessories',
    categories: ['medicine-ball', 'medicineball', 'bosu-ball', 'vitruvian'],
  },
  {
    id: 'mobility',
    categories: ['yoga', 'pilates', 'stretches', 'recovery'],
  },
  {
    id: 'cardio',
    categories: ['cardio'],
  },
];

const GROUP_BY_ID = Object.fromEntries(EQUIPMENT_GROUPS.map((g) => [g.id, g]));

const CATEGORY_TO_GROUP = {};
for (const group of EQUIPMENT_GROUPS) {
  for (const cat of group.categories) {
    CATEGORY_TO_GROUP[cat] = group.id;
  }
}

function categoriesForGroup(groupId) {
  return GROUP_BY_ID[groupId]?.categories ?? null;
}

function groupIdForCategory(category) {
  return CATEGORY_TO_GROUP[category] ?? 'other';
}

function allGroupedCategories() {
  return [...new Set(EQUIPMENT_GROUPS.flatMap((g) => g.categories))];
}

function isOtherGroup(groupId) {
  return groupId === 'other';
}

module.exports = {
  EQUIPMENT_GROUPS,
  categoriesForGroup,
  groupIdForCategory,
  allGroupedCategories,
  isOtherGroup,
};
