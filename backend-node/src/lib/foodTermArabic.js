/**
 * Static EN → AR labels for USDA food names, categories, and nutrients.
 * Phrases are matched before single words (longest first).
 */

const FOOD_PHRASE_AR = {
  'egg white': 'بياض البيض',
  'egg yolk': 'صفار البيض',
  'egg whole': 'بيض كامل',
  'whole egg': 'بيض كامل',
  'grade a': 'درجة أ',
  'grade aa': 'درجة أ',
  'grade b': 'درجة ب',
  'grade c': 'درجة ج',
  'without salt': 'بدون ملح',
  'with salt': 'بملح',
  'added salt': 'مضاف له ملح',
  'no salt': 'بدون ملح',
  'boneless skinless': 'بدون عظم وجلد',
  'skinless boneless': 'بدون عظم وجلد',
  'with skin': 'بالجلد',
  'without skin': 'بدون جلد',
  'whole milk': 'حليب كامل الدسم',
  'low fat': 'قليل الدسم',
  'nonfat': 'خالي الدسم',
  'reduced fat': 'قليل الدسم',
  'extra lean': 'قليل الدهن جداً',
  'ground beef': 'لحم بقر مفروم',
  'chicken breast': 'صدر دجاج',
  'chicken thigh': 'فخذ دجاج',
  'olive oil': 'زيت زيتون',
  'coconut oil': 'زيت جوز الهند',
  'vegetable oil': 'زيت نباتي',
  'canola oil': 'زيت الكانولا',
  'white rice': 'أرز أبيض',
  'brown rice': 'أرز بني',
  'white bread': 'خبز أبيض',
  'whole wheat': 'قمح كامل',
  'greek yogurt': 'زبادي يوناني',
  'plain yogurt': 'زبادي عادي',
  'cottage cheese': 'جبن قريش',
  'cream cheese': 'جبن كريمي',
  'cheddar cheese': 'جبن شيدر',
  'mozzarella cheese': 'جبن موزاريلا',
  'sweet potato': 'بطاطا حلوة',
  'green beans': 'فاصوليا خضراء',
  'black beans': 'فاصوليا سوداء',
  'kidney beans': 'فاصوليا حمراء',
  'orange juice': 'عصير برتقال',
  'apple juice': 'عصير تفاح',
};

const FOOD_TERM_AR = {
  egg: 'بيض',
  eggs: 'بيض',
  white: 'أبيض',
  yolk: 'صفار',
  grade: 'درجة',
  large: 'كبير',
  medium: 'متوسط',
  small: 'صغير',
  jumbo: 'كبير جداً',
  extra: 'إضافي',
  lean: 'قليل الدهن',
  raw: 'نيء',
  cooked: 'مطبوخ',
  boiled: 'مسلوق',
  fried: 'مقلي',
  grilled: 'مشوي',
  roasted: 'محمص',
  baked: 'مخبوز',
  steamed: 'مطهو على البخار',
  dried: 'مجفف',
  frozen: 'مجمد',
  fresh: 'طازج',
  canned: 'معلب',
  whole: 'كامل',
  skinless: 'بدون جلد',
  boneless: 'بدون عظم',
  salted: 'مملح',
  unsalted: 'بدون ملح',
  organic: 'عضوي',
  yogurt: 'زبادي',
  milk: 'حليب',
  cheese: 'جبن',
  butter: 'زبدة',
  cream: 'كريمة',
  chicken: 'دجاج',
  turkey: 'ديك رومي',
  beef: 'لحم بقر',
  pork: 'لحم خنزير',
  lamb: 'لحم غنم',
  veal: 'لحم عجل',
  fish: 'سمك',
  salmon: 'سلمون',
  tuna: 'تونة',
  shrimp: 'جمبري',
  rice: 'أرز',
  bread: 'خبز',
  pasta: 'معكرونة',
  potato: 'بطاطس',
  tomato: 'طماطم',
  onion: 'بصل',
  garlic: 'ثوم',
  apple: 'تفاح',
  banana: 'موز',
  orange: 'برتقال',
  oil: 'زيت',
  olive: 'زيتون',
  coconut: 'جوز الهند',
  honey: 'عسل',
  sugar: 'سكر',
  salt: 'ملح',
  flour: 'دقيق',
  oats: 'شوفان',
  almond: 'لوز',
  peanut: 'فول سوداني',
  walnut: 'جوز',
  water: 'ماء',
  juice: 'عصير',
  coffee: 'قهوة',
  tea: 'شاي',
  plain: 'عادي',
  natural: 'طبيعي',
  liquid: 'سائل',
  solid: 'صلب',
  uncooked: 'غير مطبوخ',
  ns: '',
  nfs: '',
  usda: '',
  sr: '',
  legacy: '',
};

const NUTRIENT_TERM_AR = {
  protein: 'بروتين',
  'total lipid (fat)': 'دهون',
  'total lipid': 'دهون',
  fat: 'دهون',
  carbohydrate: 'كربوهيدرات',
  'carbohydrate, by difference': 'كربوهيدرات',
  fiber: 'ألياف',
  'dietary fiber': 'ألياف غذائية',
  sugars: 'سكريات',
  'total sugars': 'سكريات',
  calcium: 'كالسيوم',
  iron: 'حديد',
  magnesium: 'مغنيسيوم',
  phosphorus: 'فوسفور',
  potassium: 'بوتاسيوم',
  sodium: 'صوديوم',
  zinc: 'زنك',
  copper: 'نحاس',
  manganese: 'منغنيز',
  selenium: 'سيلينيوم',
  'vitamin a': 'فيتامين أ',
  'vitamin c': 'فيتامين ج',
  'vitamin d': 'فيتامين د',
  'vitamin e': 'فيتامين هـ',
  'vitamin k': 'فيتامين ك',
  thiamin: 'ثيامين',
  riboflavin: 'ريبوفلافين',
  niacin: 'نياسين',
  'pantothenic acid': 'حمض البانتوثينيك',
  'vitamin b-6': 'فيتامين ب6',
  'vitamin b-12': 'فيتامين ب12',
  folate: 'حمض الفوليك',
  choline: 'كولين',
  cholesterol: 'كوليسترول',
  water: 'ماء',
  ash: 'رماد',
  energy: 'طاقة',
  caffeine: 'كافيين',
  alcohol: 'كحول',
};

const PHRASE_ENTRIES = Object.entries(FOOD_PHRASE_AR).sort((a, b) => b[0].length - a[0].length);

function containsLatin(text) {
  return /[A-Za-z]/.test(String(text || ''));
}

function lookupPhrase(part) {
  const lower = part.trim().toLowerCase();
  for (const [en, ar] of PHRASE_ENTRIES) {
    if (lower === en) return ar;
  }
  return null;
}

function lookupTerm(word) {
  const w = word.trim().toLowerCase().replace(/[.,]/g, '');
  if (!w) return '';
  if (FOOD_TERM_AR[w] != null) return FOOD_TERM_AR[w];
  return null;
}

function lookupNutrient(name) {
  const lower = String(name || '').trim().toLowerCase();
  if (NUTRIENT_TERM_AR[lower]) return NUTRIENT_TERM_AR[lower];
  for (const [en, ar] of Object.entries(NUTRIENT_TERM_AR)) {
    if (lower.includes(en)) return ar;
  }
  return null;
}

module.exports = {
  FOOD_PHRASE_AR,
  FOOD_TERM_AR,
  NUTRIENT_TERM_AR,
  PHRASE_ENTRIES,
  containsLatin,
  lookupPhrase,
  lookupTerm,
  lookupNutrient,
};
