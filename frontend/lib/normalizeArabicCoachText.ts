const ARABIC =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const ARABIC_CHAR = ARABIC;

/** Short words that must keep a following space. */
const ARABIC_KEEP_SPACE_AFTER = new Set([
  'في',
  'من',
  'إلى',
  'الى',
  'إلي',
  'على',
  'عن',
  'مع',
  'بعد',
  'قبل',
  'حتى',
  'ثم',
  'أو',
  'او',
  'و',
  'يا',
  'بل',
  'لم',
  'لن',
  'إن',
  'ان',
  'لا',
  'ما',
  'كل',
  'هذا',
  'هذه',
  'ذلك',
  'تلك',
  'عند',
  'لكن',
  'لو',
  'إذا',
  'اذا',
  'كما',
  'حيث',
  'أي',
  'اي',
  'بين',
  'أنت',
  'انت',
  'هو',
  'هي',
  'هم',
  'هنا',
  'هناك',
  'كيف',
  'متى',
  'لماذا',
  'ممكن',
  'عايز',
  'عاوز',
  'محتاج',
  'تكوين',
  'منصة',
  'لياقة',
  'بدنية',
  'متكاملة',
  'الرياضيين',
  'حاجة',
  'مكان',
  'واحد',
]);

/** Prefixes that LLMs often split from the next word ("الم ميزات"). */
const ARABIC_MERGE_PREFIXES = ['الم', 'لل', 'بال', 'وال', 'فال', 'كال', 'ال', 'مح'];

function hasArabic(text: string): boolean {
  return ARABIC_CHAR.test(text);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fix only obvious LLM token splits inside Arabic words.
 * Must NOT remove normal spaces between words.
 */
export function normalizeArabicCoachText(text: string): string {
  if (!text || !hasArabic(text)) return text;

  let out = text;

  // "الم ميزات", "لل رياضيين", "مح تاجها"
  for (const prefix of ARABIC_MERGE_PREFIXES) {
    out = out.replace(
      new RegExp(`${escapeRegExp(prefix)}\\s+(?=${ARABIC_CHAR.source})`, 'gu'),
      prefix,
    );
  }

  // "ه ي" -> "هي" when two isolated letters are split by the model.
  out = out.replace(
    /(?<=[\s،.!?؟:(\[])([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])\s+([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])(?=[\s،.!?؟:)\]]|$)/gu,
    (_match, first: string, second: string) => {
      if (ARABIC_KEEP_SPACE_AFTER.has(first)) {
        return `${first} ${second}`;
      }
      return `${first}${second}`;
    },
  );

  // Collapse accidental double spaces in Arabic runs only.
  out = out.replace(
    /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])\s{2,}(?=[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])/g,
    '$1 ',
  );

  return out;
}
