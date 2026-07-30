import { describe, expect, it } from 'vitest';
import { computeNutritionStats } from './stats';
import type { AppEvent } from '../types';

function meal(occurredAt: string, proteinG?: number, calories?: number, mealName = 'Meal'): AppEvent {
  return {
    id: `m-${occurredAt}-${Math.random()}`,
    type: 'meal',
    category: 'action',
    occurredAt,
    precision: 'exact',
    mealName,
    ...(proteinG !== undefined ? { proteinG } : {}),
    ...(calories !== undefined ? { calories } : {}),
  };
}

// "now" is midday on 2026-07-14 (a Tuesday).
const NOW = '2026-07-14T12:00:00+01:00';

describe('computeNutritionStats', () => {
  it('buckets protein into 7 day-columns ending today', () => {
    const events = [
      meal('2026-07-14T08:00:00+01:00', 30, 400),
      meal('2026-07-14T13:00:00+01:00', 40, 600),
      meal('2026-07-13T20:00:00+01:00', 50, 700),
      meal('2026-07-07T09:00:00+01:00', 999, 999), // outside the 7-day window
    ];
    const s = computeNutritionStats(events, NOW, 150);
    expect(s.days).toHaveLength(7);
    expect(s.days[0].key).toBe('2026-07-08'); // oldest bucket
    const today = s.days[6];
    expect(today.isToday).toBe(true);
    expect(today.protein).toBe(70);
    expect(s.days[5].protein).toBe(50); // yesterday
    // The out-of-window meal is ignored.
    expect(s.days.every((d) => d.protein < 999)).toBe(true);
  });

  it('flags target hits, week average, and hit count', () => {
    const events = [
      meal('2026-07-14T08:00:00+01:00', 160), // today hits
      meal('2026-07-13T08:00:00+01:00', 155), // yesterday hits
      meal('2026-07-12T08:00:00+01:00', 100), // misses
    ];
    const s = computeNutritionStats(events, NOW, 150);
    expect(s.days[6].hit).toBe(true);
    expect(s.days[5].hit).toBe(true);
    expect(s.days[4].hit).toBe(false);
    expect(s.weekHits).toBe(2);
    // Averaged over the three logged days, not over seven calendar days:
    // dividing by 7 silently understates a partly-logged week.
    expect(s.weekAvg).toBe(Math.round((160 + 155 + 100) / 3));
    expect(s.daysLogged).toBe(3);
  });

  it('marks days with no meals as unlogged rather than zero', () => {
    const events = [meal('2026-07-14T08:00:00+01:00', 160)];
    const s = computeNutritionStats(events, NOW, 150);
    expect(s.days[6].logged).toBe(true);
    expect(s.days[5].logged).toBe(false);
    expect(s.days[5].protein).toBe(0);
    expect(s.daysLogged).toBe(1);
  });

  it('does not let unlogged days drag the average down', () => {
    const events = [
      meal('2026-07-14T08:00:00+01:00', 200),
      meal('2026-07-13T08:00:00+01:00', 200),
    ];
    const s = computeNutritionStats(events, NOW, 150);
    expect(s.weekAvg).toBe(200);
  });

  it('counts a real zero-protein day as logged', () => {
    const events = [meal('2026-07-14T08:00:00+01:00', 0)];
    const s = computeNutritionStats(events, NOW, 150);
    expect(s.days[6].logged).toBe(true);
    expect(s.days[6].hit).toBe(false);
    expect(s.daysLogged).toBe(1);
  });

  it('computes avg per meal, avg kcal, and most-logged name', () => {
    const events = [
      meal('2026-07-14T08:00:00+01:00', 30, 400, 'Oats'),
      meal('2026-07-14T13:00:00+01:00', 60, 800, 'Chicken bowl'),
      meal('2026-07-13T08:00:00+01:00', 30, 400, 'Oats'),
    ];
    const s = computeNutritionStats(events, NOW, 150);
    expect(s.avgPerMeal).toBe(Math.round((30 + 60 + 30) / 3));
    expect(s.avgKcal).toBe(Math.round((1200 + 400) / 2));
    expect(s.mostLogged).toBe('Oats');
  });

  it('handles an empty week', () => {
    const s = computeNutritionStats([], NOW, 150);
    expect(s.weekAvg).toBe(0);
    expect(s.weekHits).toBe(0);
    expect(s.daysLogged).toBe(0);
    expect(s.avgPerMeal).toBe(0);
    expect(s.mostLogged).toBeNull();
    expect(s.paceMessage).toContain('behind pace');
  });

  it('reports being ahead of pace when protein is stacked early', () => {
    const events = [meal('2026-07-14T08:00:00+01:00', 140)];
    const s = computeNutritionStats(events, NOW, 150);
    expect(s.paceMessage).toContain('ahead of pace');
  });
});
