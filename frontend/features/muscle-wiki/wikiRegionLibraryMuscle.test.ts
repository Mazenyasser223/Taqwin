import { describe, it, expect } from 'vitest';
import {
  libraryCountForWikiRegion,
  libraryMuscleForWikiRegion,
  muscleWikiLibraryUrl,
} from './wikiRegionLibraryMuscle';

describe('wikiRegionLibraryMuscle', () => {
  const browseCounts = { glutes: 166, forearms: 62, lats: 120, lowerback: 40, traps: 30, trapsmiddle: 20 };

  it('maps hands to forearms for library filter', () => {
    expect(libraryMuscleForWikiRegion('hands')).toBe('forearms');
    expect(libraryCountForWikiRegion('hands', browseCounts)).toBe(62);
  });

  it('uses browse counts for glutes', () => {
    expect(libraryMuscleForWikiRegion('glutes')).toBe('glutes');
    expect(libraryCountForWikiRegion('glutes', browseCounts)).toBe(166);
  });

  it('aggregates coarse back region from pull browse zones', () => {
    expect(libraryMuscleForWikiRegion('back')).toBeNull();
    expect(libraryCountForWikiRegion('back', browseCounts)).toBe(210);
  });

  it('builds browse library URLs without wiki flag', () => {
    expect(muscleWikiLibraryUrl('chest')).toBe('/workouts?muscle=chest');
    expect(muscleWikiLibraryUrl('hands')).toBe('/workouts?muscle=forearms');
    expect(muscleWikiLibraryUrl('lats', 'ex-1')).toBe('/workouts?muscle=lats&exercise=ex-1');
  });
});
