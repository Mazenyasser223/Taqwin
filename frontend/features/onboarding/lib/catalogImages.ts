import type { Exercise, FdcFoodPreview } from '../../../types';
import { categoryImageCandidates, taqwinIdFromSlug } from '../../nutrition/nutritionCategoryTheme';

const EXERCISE_FALLBACK =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600';

export function exerciseImageUrl(exercise: Pick<Exercise, 'name'> & { thumbnailUrl?: string | null }): string {
  return exercise.thumbnailUrl || EXERCISE_FALLBACK;
}

/** Category photo with slight variety per food row. */
export function foodImageUrl(food: FdcFoodPreview): string {
  const catId = food.categoryId ? taqwinIdFromSlug(food.categoryId) : 'other';
  const candidates = categoryImageCandidates(catId);
  if (food.webtebId && candidates.length > 1) {
    return candidates[food.webtebId % candidates.length];
  }
  return candidates[0] ?? EXERCISE_FALLBACK;
}

export function categoryChipImage(categoryId: string): string {
  return categoryImageCandidates(taqwinIdFromSlug(categoryId))[0];
}
