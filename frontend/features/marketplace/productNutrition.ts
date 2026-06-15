import type { Product } from '../../types';
import type { DescriptionSection } from '../../lib/shopDescription';

const SUPPLEMENT_CATEGORY =
  /supplement|whey|creatine|pre-workout|bcaa|protein|vitamin|mass-gainer|fat-burner|collagen|omega|amino|glutamine|eaa/i;

const NUTRITION_HTML =
  /nutrition\s*facts|nutritional\s*information|serving\s*size|calories|per\s*serving|macros/i;

export function isSupplementProduct(product: Product): boolean {
  const slug = product.category?.slug ?? '';
  if (SUPPLEMENT_CATEGORY.test(slug)) return true;
  const name = `${product.name} ${product.brand}`.toLowerCase();
  return /\b(whey|creatine|protein powder|pre-workout|bcaa|mass gainer|vitamin)\b/.test(name);
}

export function extractNutritionHtml(sections: DescriptionSection[]): string | null {
  for (const section of sections) {
    if (NUTRITION_HTML.test(section.html)) return section.html;
  }
  return null;
}
