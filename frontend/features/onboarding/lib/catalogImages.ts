import type { Exercise, FdcFoodPreview } from '../../../types';
import { foodImageUrl as mappedFoodImageUrl } from '../../nutrition/foodImages';

const EXERCISE_FALLBACK =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600';

export function exerciseImageUrl(exercise: Pick<Exercise, 'name'> & { thumbnailUrl?: string | null }): string {
  return exercise.thumbnailUrl || EXERCISE_FALLBACK;
}

/** Per-food photo when mapped from nutrition/ assets; undefined otherwise. */
export function foodImageUrl(food: FdcFoodPreview): string | undefined {
  return mappedFoodImageUrl(food);
}

export function categoryChipImage(categoryId: string): string | undefined {
  void categoryId;
  return undefined;
}
