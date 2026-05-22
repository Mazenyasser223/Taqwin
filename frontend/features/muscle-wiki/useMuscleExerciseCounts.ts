import { useEffect, useState } from 'react';
import exerciseService from '../../services/exerciseService';
import type { MuscleZone } from './types';

export function useMuscleExerciseCounts(): Record<MuscleZone, number> | null {
  const [counts, setCounts] = useState<Record<MuscleZone, number> | null>(null);

  useEffect(() => {
    let mounted = true;
    exerciseService.getMuscleCounts().then((res) => {
      if (!mounted || !res.data) return;
      setCounts(res.data as Record<MuscleZone, number>);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return counts;
}
