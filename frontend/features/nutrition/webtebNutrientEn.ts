import type { AppLanguage } from '../../services/settingsService';

/** WebTeb nutrient labels (Arabic, as stored in DB) → USDA-style English. */
export const WEBTEB_NUTRIENT_AR_EN: Record<string, string> = {
  أرجينين: 'Arginine',
  ألانين: 'Alanine',
  'االكولين، النهائي': 'Choline, total',
  'الكولين، النهائي': 'Choline, total',
  'الاحماض الدهنية، النهائية المشبعة': 'Fatty acids, total saturated',
  'الاحماض الدهنية، النهائية غير المشبعة': 'Fatty acids, total monounsaturated',
  'الاحماض الدهنية، مجموع الاحادية الغير مشبعة': 'Fatty acids, total monounsaturated',
  'الاحماض الدهنية، مجموع الاحادية المشبعة': 'Fatty acids, total saturated',
  'الاحماض الدهنية، مجموع المتعددة الغير مشبعة': 'Fatty acids, total polyunsaturated',
  'الاحماض الدهنية، مجموع المتعددة المشبعة': 'Fatty acids, total polyunsaturated',
  'الالياف 291': 'Fiber, total dietary',
  البرولين: 'Proline',
  'البوتاسيوم، K': 'Potassium, K',
  البيتين: 'Betaine',
  التربتوفان: 'Tryptophan',
  التيروزين: 'Tyrosine',
  الثيامين: 'Thiamin',
  الجالاكتوز: 'Galactose',
  الجلايسين: 'Glycine',
  'الحامض الاميني': 'Amino acids',
  'الحديد، Fe': 'Iron, Fe',
  الريبوفلافين: 'Riboflavin',
  'الزينك، Zn': 'Zinc, Zn',
  'السعرات الحرارية من البروتين': 'Calories from protein',
  'السعرات الحرارية من الدهون': 'Calories from fat',
  'السعرات الحرارية من الكربوهيدرات': 'Calories from carbohydrates',
  'السكريات 269': 'Sugars, total',
  السيستين: 'Cystine',
  'السيلينيوم، Se': 'Selenium, Se',
  'الصوديوم، Na': 'Sodium, Na',
  'الفسفور، P': 'Phosphorus, P',
  'الفلوريد، F': 'Fluoride, F',
  'الفينيل ألانين': 'Phenylalanine',
  الكربوهيدرات: 'Carbohydrate, by difference',
  'الكربوهيدرات 205': 'Carbohydrate, by difference',
  اللاكتوز: 'Lactose',
  'المنجنيز، Mn': 'Manganese, Mn',
  'النحاس، Cu': 'Copper, Cu',
  النياسين: 'Niacin',
  'الهيدروكسي برولين': 'Hydroxyproline',
  بروتين: 'Protein',
  ثريونين: 'Threonine',
  'حمض أميني أساسي': 'Essential amino acids',
  'حمض البانتوثنيك': 'Pantothenic acid',
  'حمض الفوليك، DFE': 'Folate, DFE',
  'حمض الفوليك، الغذاء': 'Folate, food',
  'حمض الفوليك، نهائي': 'Folate, total',
  دهون: 'Total lipid (fat)',
  'سكر الشعير': 'Maltose',
  'سكر الفاكهة': 'Fructose',
  'سكر القصب': 'Sucrose',
  سيرين: 'Serine',
  طاقة: 'Energy',
  'فيتامين E': 'Vitamin E',
  'فيتامين أ، Iu': 'Vitamin A, IU',
  'فيتامين ب-12': 'Vitamin B-12',
  'فيتامين ب-6': 'Vitamin B-6',
  'فيتامين ج، نهائي حمض الاسكوربيك': 'Vitamin C, total ascorbic acid',
  'فيتامين د': 'Vitamin D',
  'فيتامين د (د2 + د3)': 'Vitamin D (D2 + D3)',
  'فيتامين د2': 'Vitamin D2',
  'فيتامين د3': 'Vitamin D3',
  'فيتامين ك (فيلوكينون)': 'Vitamin K (phylloquinone)',
  'كالسيوم، Ca': 'Calcium, Ca',
  كولسترول: 'Cholesterol',
  لوسين: 'Leucine',
  'ماغنيسيوم، Mg': 'Magnesium, Mg',
  'مجمل السعرات الحرارية': 'Energy',
  ميثيونين: 'Methionine',
  'نشاء 209': 'Starch',
  يسوليوكيني: 'Isoleucine',
  يسين: 'Lysine',
};

const LOOKUP = new Map<string, string>(
  Object.entries(WEBTEB_NUTRIENT_AR_EN).map(([ar, en]) => [normalizeNutrientKey(ar), en])
);

function normalizeNutrientKey(name: string): string {
  return (name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^االكولين/, 'الكولين')
    .toLowerCase();
}

export function localizeNutrientName(name: string, language: AppLanguage): string {
  const trimmed = (name || '').trim();
  if (!trimmed || language !== 'en') return trimmed;
  const hit = LOOKUP.get(normalizeNutrientKey(trimmed));
  return hit ?? trimmed;
}
