import { useEffect, useState } from 'react';
import exerciseService from '../../services/exerciseService';
import type { MuscleRegion } from './types';

export function useMuscleExerciseCounts(): Record<string, number> | null {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let mounted = true;
    exerciseService.getMuscleCounts('wiki').then((res) => {
      if (!mounted || !res.data) return;
      setCounts(res.data);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return counts;
}

export function countForRegion(
  region: MuscleRegion,
  muscleCounts?: Record<string, number> | null,
): number | null {
  if (muscleCounts && muscleCounts[region] != null) return muscleCounts[region];
  return null;
}
