import { useEffect, useState } from 'react';
import nutritionService from '../../services/nutritionService';
import type { FoodLog } from '../../types';
import { useLiveDietRevision } from './wellnessWidgets';
import {
  readLiveDietTotals,
  writeLiveDietTotals,
  type LiveDietTotals,
} from './liveDashboardTotals';
import {
  computeMyLogsDietTotals,
  type MealPlanSlotRef,
} from './myLogsDietTotals';

/**
 * Home KPI nutrition — always reflects My logs (meal-slot food logs), not AI plan totals.
 */
export function useLiveDietTotals(
  userId: string | undefined,
  date: string,
  mealSlots: MealPlanSlotRef[]
): LiveDietTotals | null {
  const liveDietRevision = useLiveDietRevision();
  const slotKey = mealSlots.map((s) => s.id).join('|');
  const [totals, setTotals] = useState<LiveDietTotals | null>(() =>
    readLiveDietTotals(userId, date)
  );

  // Instant updates when My logs writes session totals (same tab).
  useEffect(() => {
    if (!userId || !date) return;
    const cached = readLiveDietTotals(userId, date);
    if (cached) setTotals(cached);
  }, [userId, date, liveDietRevision]);

  // Day / slot change — peek warm cache first, then background API sync.
  useEffect(() => {
    if (!userId || !date || !mealSlots.length) {
      setTotals(null);
      return;
    }

    const applyFromLogs = (logs: FoodLog[]) => {
      const next = computeMyLogsDietTotals(logs, mealSlots, userId, date);
      writeLiveDietTotals(userId, date, next);
      setTotals(next);
    };

    const peeked = nutritionService.peekMyLogs(date);
    if (peeked) applyFromLogs(peeked);

    let cancelled = false;
    void nutritionService.getMyLogs(date).then((res) => {
      if (cancelled || res.error || !res.data) return;
      applyFromLogs(res.data);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, date, slotKey, mealSlots]);

  return totals;
}
