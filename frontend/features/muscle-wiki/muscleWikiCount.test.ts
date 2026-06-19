import { describe, it, expect } from 'vitest';
import { formatWikiExerciseCount, libraryCountForWikiRegion } from './muscleWikiCount';

describe('muscleWikiCount', () => {
  const t = (key: string, vars?: Record<string, string>) => {
    if (key === 'muscleWiki.exerciseCountOne') return '1 exercise';
    if (key === 'muscleWiki.exerciseCountLoading') return 'Loading…';
    if (key === 'muscleWiki.exerciseCount') return `${vars?.count} exercises`;
    return key;
  };

  it('reads browse library counts for wiki regions', () => {
    expect(libraryCountForWikiRegion('glutes', { glutes: 166 })).toBe(166);
    expect(libraryCountForWikiRegion('hands', { forearms: 62 })).toBe(62);
  });

  it('formats count labels', () => {
    expect(formatWikiExerciseCount(null, t)).toBe('Loading…');
    expect(formatWikiExerciseCount(1, t)).toBe('1 exercise');
    expect(formatWikiExerciseCount(166, t)).toBe('166 exercises');
  });
});
