/** USDA nutrient name → display label (EN / AR). */
const LABELS: Record<string, { en: string; ar: string }> = {
  energy: { en: 'Energy', ar: 'طاقة' },
  protein: { en: 'Protein', ar: 'بروتين' },
  'total lipid': { en: 'Fat', ar: 'دهون' },
  fat: { en: 'Fat', ar: 'دهون' },
  carbohydrate: { en: 'Carbohydrates', ar: 'الكربوهيدرات' },
  carbs: { en: 'Carbohydrates', ar: 'الكربوهيدرات' },
  fiber: { en: 'Fiber', ar: 'ألياف' },
  calcium: { en: 'Calcium', ar: 'كالسيوم' },
  iron: { en: 'Iron', ar: 'الحديد' },
  sodium: { en: 'Sodium', ar: 'الصوديوم' },
  cholesterol: { en: 'Cholesterol', ar: 'كولسترول' },
  thiamin: { en: 'Thiamin', ar: 'الثيامين' },
  riboflavin: { en: 'Riboflavin', ar: 'الريبوفلافين' },
  niacin: { en: 'Niacin', ar: 'النياسين' },
  pantothenic: { en: 'Pantothenic acid', ar: 'حمض البانتوثنيك' },
  'vitamin b-6': { en: 'Vitamin B-6', ar: 'فيتامين ب-6' },
  'vitamin b-12': { en: 'Vitamin B-12', ar: 'فيتامين ب-12' },
  folate: { en: 'Folate', ar: 'حمض الفوليك' },
  choline: { en: 'Choline', ar: 'الكولين' },
  betaine: { en: 'Betaine', ar: 'البيتين' },
  ascorbic: { en: 'Vitamin C, total ascorbic acid', ar: 'فيتامين ج، نهائي حمض الاسكوربيك' },
  'vitamin c': { en: 'Vitamin C', ar: 'فيتامين ج' },
  'vitamin a': { en: 'Vitamin A, IU', ar: 'فيتامين أ، IU' },
  'vitamin e': { en: 'Vitamin E', ar: 'فيتامين E' },
  'vitamin d (d2': { en: 'Vitamin D (D2 + D3)', ar: 'فيتامين د (د2 + د3)' },
  'vitamin d2': { en: 'Vitamin D2', ar: 'فيتامين د2' },
  'vitamin d3': { en: 'Vitamin D3', ar: 'فيتامين د3' },
  'vitamin d': { en: 'Vitamin D', ar: 'فيتامين د' },
  'vitamin k': { en: 'Vitamin K (phylloquinone)', ar: 'فيتامين ك (فيلوكينون)' },
  phylloquinone: { en: 'Vitamin K (phylloquinone)', ar: 'فيتامين ك (فيلوكينون)' },
  magnesium: { en: 'Magnesium', ar: 'ماغنيسيوم' },
  phosphorus: { en: 'Phosphorus', ar: 'الفسفور' },
  potassium: { en: 'Potassium', ar: 'البوتاسيوم' },
  zinc: { en: 'Zinc', ar: 'الزنك' },
  copper: { en: 'Copper', ar: 'النحاس' },
  manganese: { en: 'Manganese', ar: 'المنجنيز' },
  selenium: { en: 'Selenium', ar: 'السيلينيوم' },
  fluoride: { en: 'Fluoride', ar: 'الفلوريد' },
};

/** Longer / more specific keys first. */
const LABEL_KEYS = Object.keys(LABELS).sort((a, b) => b.length - a.length);

export function nutrientDisplayName(name: string, lang: 'en' | 'ar'): string {
  const lower = name.toLowerCase();
  const symbolSuffix = name.match(/,\s*([A-Za-z0-9][A-Za-z0-9+-]*)\s*$/);

  for (const key of LABEL_KEYS) {
    if (!lower.includes(key)) continue;
    const labels = LABELS[key];
    let label = labels[lang];

    if (key === 'vitamin a' && (lower.includes('iu') || name.toUpperCase().includes('IU'))) {
      label = lang === 'ar' ? 'فيتامين أ، IU' : 'Vitamin A, IU';
    }

    if (symbolSuffix && lang === 'ar' && !label.includes('،')) {
      return `${label}، ${symbolSuffix[1]}`;
    }
    if (symbolSuffix && lang === 'en' && !label.includes(',')) {
      return `${label}, ${symbolSuffix[1]}`;
    }
    return label;
  }
  return name;
}

export function formatNutrientAmount(amount: number, unit: string): string {
  const u = unit?.trim() || '';
  if (u.toLowerCase() === 'kcal') return `${amount} kcal`;
  if (u.toLowerCase() === 'iu') return `${amount} IU`;
  if (u.toLowerCase() === 'ug' || u === 'µg') return `${amount} mcg`;
  if (u) return `${amount} ${u}`;
  return String(amount);
}
