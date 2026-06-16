const TEXT_NEGATIVE_PATTERN =
  /\b(bad|terrible|awful|worst|dirty|broken|old|disappoint|hate|never|avoid|overpriced|crowded|rude|unprofessional|waste)\b|سيئ(?:ة|ه)?|قديم(?:ة|ه)?|وسخ(?:ة|ه)?|ردي(?:ء|)|مخيب|مزعج|فظ|غالي|زحمة|لا\s*أنصح|اسوأ|أسوأ/i;
const TEXT_POSITIVE_PATTERN =
  /\b(great|excellent|amazing|love|clean|friendly|professional|recommend|worth|perfect|best)\b|ممتاز(?:ة|ه)?|رائع(?:ة|ه)?|جميل(?:ة|ه)?|نظيف(?:ة|ه)?|ودود|احتراف|أنصح|انصح|مذهل/i;

export type ReviewRatingTextMismatch = 'highStarsNegativeText' | 'lowStarsPositiveText';

function textSentimentLabel(body: string): 'positive' | 'negative' | 'neutral' | null {
  const text = body.trim();
  if (!text) return null;
  const negative = TEXT_NEGATIVE_PATTERN.test(text);
  const positive = TEXT_POSITIVE_PATTERN.test(text);
  if (negative && !positive) return 'negative';
  if (positive && !negative) return 'positive';
  if (negative && positive) return 'neutral';
  return null;
}

/** Detect when star rating clearly conflicts with review text tone. */
export function detectReviewRatingTextMismatch(
  rating: number,
  body: string,
): ReviewRatingTextMismatch | null {
  const fromText = textSentimentLabel(body);
  if (!fromText) return null;
  if (rating >= 4 && fromText === 'negative') return 'highStarsNegativeText';
  if (rating <= 2 && fromText === 'positive') return 'lowStarsPositiveText';
  return null;
}
