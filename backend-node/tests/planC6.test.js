import { describe, it, expect } from 'vitest';
import {
  formatTodayPlanResponse,
  formatWeekPlanResponse,
  formatWorkoutDay,
} from '../src/lib/plans/planApiFormat.js';

describe('Block C6 planApiFormat', () => {
  it('formatWorkoutDay marks rest when no exercises', () => {
    const day = { dayIndex: 3, isRestDay: true, focus: 'rest', exercises: [] };
    expect(formatWorkoutDay(day).isRest).toBe(true);
  });

  it('formatTodayPlanResponse includes workout and diet', () => {
    const body = formatTodayPlanResponse({
      dailyPlan: {
        id: 'd1',
        status: 'active',
        lifeMode: 'normal',
        readinessScore: null,
        explainabilityText: 'Because goals.',
        workoutPlanDay: {
          dayIndex: 1,
          isRestDay: false,
          focus: 'push',
          exercises: [
            {
              exerciseId: 'e1',
              sets: 3,
              reps: '10',
              restSec: 90,
              notes: '',
              exercise: { id: 'e1', name: 'Bench', nameAr: null, category: 'chest' },
            },
          ],
        },
        dietPlanDay: {
          dayIndex: 1,
          meals: [
            {
              mealType: 'breakfast',
              items: [{ foodItemId: 'f1', label: 'Oats', quantity: 80, foodItem: { id: 'f1', name: 'Oats', calories: 100 } }],
            },
          ],
        },
      },
      dayIndex: 1,
      date: new Date('2026-06-01T00:00:00.000Z'),
      timezone: 'UTC',
      workoutPlan: { id: 'w1', targetCalories: null, targetProteinG: null },
      dietPlan: {
        id: 'dp1',
        targetCalories: 2200,
        targetProteinG: 150,
        targetCarbsG: 200,
        targetFatG: 70,
      },
    });

    expect(body.workout.exercises).toHaveLength(1);
    expect(body.diet.meals).toHaveLength(1);
    expect(body.dailyTargets.calories).toBe(2200);
    expect(body.meta.dailyAthletePlanId).toBe('d1');
  });

  it('formatWeekPlanResponse returns null without plans', () => {
    expect(formatWeekPlanResponse({ workoutPlan: null, dietPlan: null })).toBeNull();
  });

  it('formatWeekPlanResponse includes 7 workout days', () => {
    const days = Array.from({ length: 7 }, (_, i) => ({
      dayIndex: i + 1,
      isRestDay: i === 2,
      focus: i === 2 ? 'rest' : 'work',
      exercises: i === 2 ? [] : [{ exerciseId: 'e1', sets: 3, reps: '8', restSec: 60, notes: '', exercise: { id: 'e1', name: 'Row', nameAr: null, category: 'back' } }],
    }));
    const week = formatWeekPlanResponse({
      workoutPlan: { id: 'w', weekStart: new Date('2026-06-01'), status: 'active', source: 'onboarding', locale: 'ar', days },
      dietPlan: { id: 'd', weekStart: new Date('2026-06-01'), status: 'active', source: 'onboarding', locale: 'ar', days: days.map((d) => ({ dayIndex: d.dayIndex, meals: [] })) },
      dailyPlans: [],
    });
    expect(week.workout.days).toHaveLength(7);
    expect(week.diet.days).toHaveLength(7);
  });
});
