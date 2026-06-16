import { describe, it, expect } from 'vitest';
import { exerciseThumbnailCandidates, optimizeExerciseThumbnailUrl } from './exerciseThumbUrl';

describe('exerciseThumbnail', () => {
  it('adds webp params for unsplash URLs', () => {
    const url = optimizeExerciseThumbnailUrl(
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600',
    );
    expect(url).toContain('fm=webp');
    expect(url).toContain('w=480');
  });

  it('falls back through candidates ending with fallback', () => {
    const candidates = exerciseThumbnailCandidates('https://cdn.example.com/thumb.jpg');
    expect(candidates[0]).toContain('.webp');
    expect(candidates).toContain('https://cdn.example.com/thumb.jpg');
    expect(candidates[candidates.length - 1]).toContain('unsplash.com');
  });
});
