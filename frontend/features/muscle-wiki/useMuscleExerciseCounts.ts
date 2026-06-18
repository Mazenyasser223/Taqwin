import { useEffect, useState } from 'react';
import exerciseService from '../../services/exerciseService';
import type { MuscleRegion } from './types';

export function useMuscleExerciseCounts(): {
  counts: Record<string, number> | null;
  loading: boolean;
} {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    exerciseService.getMuscleCounts('browse').then((res) => {
      if (!mounted) return;
      if (res.data) setCounts(res.data);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return { counts, loading };
}

/** @deprecated Use wikiCountForRegion from muscleWikiCount.ts */
export function countForRegion(
  region: MuscleRegion,
  muscleCounts?: Record<string, number> | null,
): number | null {
  if (muscleCounts && muscleCounts[region] != null) return muscleCounts[region];
  return null;
}

