import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import exerciseService from '../../services/exerciseService';

export function useExerciseFavorites() {
  const user = useAuthStore((s) => s.user);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!user) {
      setFavoriteIds(new Set());
      setLoaded(true);
      return;
    }
    const res = await exerciseService.getFavoriteIds();
    if (res.data) {
      setFavoriteIds(new Set(res.data.exerciseIds));
    }
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    setLoaded(false);
    void reload();
  }, [reload]);

  const isFavorite = useCallback(
    (exerciseId: string) => favoriteIds.has(exerciseId),
    [favoriteIds],
  );

  const isToggling = useCallback(
    (exerciseId: string) => loadingIds.has(exerciseId),
    [loadingIds],
  );

  const toggleFavorite = useCallback(
    async (exerciseId: string, nextSaved: boolean) => {
      if (!user) return false;

      setFavoriteIds((prev) => {
        const copy = new Set(prev);
        if (nextSaved) copy.add(exerciseId);
        else copy.delete(exerciseId);
        return copy;
      });
      setLoadingIds((prev) => new Set(prev).add(exerciseId));

      const res = nextSaved
        ? await exerciseService.saveFavorite(exerciseId)
        : await exerciseService.removeFavorite(exerciseId);

      setLoadingIds((prev) => {
        const copy = new Set(prev);
        copy.delete(exerciseId);
        return copy;
      });

      if (res.error) {
        setFavoriteIds((prev) => {
          const copy = new Set(prev);
          if (nextSaved) copy.delete(exerciseId);
          else copy.add(exerciseId);
          return copy;
        });
        return false;
      }
      return true;
    },
    [user],
  );

  return useMemo(
    () => ({
      loaded,
      favoriteIds,
      isFavorite,
      isToggling,
      toggleFavorite,
      reload,
    }),
    [loaded, favoriteIds, isFavorite, isToggling, toggleFavorite, reload],
  );
}
