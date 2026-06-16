import type { MuscleZone } from '../muscle-wiki/types';
import type { EquipmentGroupId } from './exerciseCategoryGroups';

export const EXERCISE_CATEGORY_IMAGE_DIR = '/workouts/categories';

const LOCAL_EXT = ['.webp', '.jpg', '.jpeg', '.png', '.jfif', '.avif'] as const;

/** Curated Unsplash images — verified URLs; each matches the category meaning. */
export const EXERCISE_CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  chest:
    'https://images.unsplash.com/photo-1653773869760-5b0f846231fb?auto=format&fit=crop&w=800&q=80',
  back: 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?auto=format&fit=crop&w=800&q=80',
  shoulders:
    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80',
  biceps:
    'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=800&q=80',
  triceps:
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
  forearms:
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80',
  abs: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80',
  quads:
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80',
  hamstrings:
    'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=800&q=80',
  calves:
    'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=800&q=80',
  glutes:
    'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=800&q=80',
  'free-weights':
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
  'machines-cables':
    'https://images.unsplash.com/photo-1764426445439-681ca4a15c1d?auto=format&fit=crop&w=800&q=80',
  'bodyweight-bands':
    'https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?auto=format&fit=crop&w=800&q=80',
  accessories:
    'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=800&q=80',
  mobility:
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80',
  cardio:
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80',
  other:
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
};

const DEFAULT_EXERCISE_CATEGORY_IMAGE =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80';

export type ExerciseBrowseCategoryId = MuscleZone | EquipmentGroupId | 'other';

function localPathsForId(id: string): string[] {
  const paths: string[] = [];
  for (const ext of LOCAL_EXT) {
    paths.push(`${EXERCISE_CATEGORY_IMAGE_DIR}/${id}${ext}`);
  }
  return paths;
}

/** Local public files first, then Unsplash fallback. */
export function exerciseCategoryImageCandidates(id: ExerciseBrowseCategoryId | string): string[] {
  const fallback = EXERCISE_CATEGORY_FALLBACK_IMAGES[id] ?? DEFAULT_EXERCISE_CATEGORY_IMAGE;
  return [...new Set([...localPathsForId(id), fallback])];
}

export function exerciseCategoryImageUrl(id: ExerciseBrowseCategoryId | string): string {
  return exerciseCategoryImageCandidates(id)[0];
}
