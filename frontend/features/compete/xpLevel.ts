/** XP required to advance one display level (shared with compete profile). */
export const XP_LEVEL_STEP = 1500;

export function xpLevelProgress(lifetimeXp: number) {
  const safe = Math.max(0, Math.floor(lifetimeXp));
  const ptsInLevel = safe % XP_LEVEL_STEP;
  const ptsToNext = ptsInLevel === 0 && safe > 0 ? 0 : XP_LEVEL_STEP - ptsInLevel;
  const level = Math.floor(safe / XP_LEVEL_STEP) + 1;
  return { ptsInLevel, ptsToNext, level };
}
