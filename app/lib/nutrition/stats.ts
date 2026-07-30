import { wallDateKey, wallParts } from '../time';
import type { AppEvent } from '../types';

export interface DayProtein {
  key: string; // YYYY-MM-DD
  label: string; // single-letter weekday
  protein: number;
  hit: boolean; // reached the protein target
  logged: boolean; // any meal recorded — a gap is not a zero
  isToday: boolean;
}

export interface NutritionStats {
  days: DayProtein[]; // 7 days ending today, ascending (oldest → today)
  weekAvg: number; // mean protein across *logged* days
  weekHits: number; // days that hit target, of the logged days
  daysLogged: number; // days with at least one meal, of 7
  avgPerMeal: number; // mean protein per logged meal across the window
  avgKcal: number; // mean daily calories across the 7 days
  mostLogged: string | null; // most frequently logged meal name
  paceMessage: string;
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** "YYYY-MM-DD" shifted by whole days, computed in UTC to avoid DST drift. */
function shiftKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekdayLetter(key: string): string {
  return WEEKDAY_LETTERS[new Date(`${key}T12:00:00Z`).getUTCDay()];
}

/**
 * Derive the nutrition numbers panel from the week's events. Pure: the caller
 * (useWeek) already fetches the last ~8 days; we look only at `meal` events.
 */
export function computeNutritionStats(
  weekEvents: readonly AppEvent[],
  nowIso: string,
  proteinTarget: number,
): NutritionStats {
  const meals = weekEvents.filter((e) => e.type === 'meal');
  const todayKey = wallDateKey(nowIso);

  // Seven day buckets ending today.
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) keys.push(shiftKey(todayKey, -i));

  const proteinByDay = new Map<string, number>();
  const kcalByDay = new Map<string, number>();
  const mealCountByDay = new Map<string, number>();
  for (const k of keys) {
    proteinByDay.set(k, 0);
    kcalByDay.set(k, 0);
    mealCountByDay.set(k, 0);
  }
  for (const m of meals) {
    const k = wallDateKey(m.occurredAt);
    if (!proteinByDay.has(k)) continue;
    proteinByDay.set(k, (proteinByDay.get(k) ?? 0) + (m.proteinG ?? 0));
    kcalByDay.set(k, (kcalByDay.get(k) ?? 0) + (m.calories ?? 0));
    mealCountByDay.set(k, (mealCountByDay.get(k) ?? 0) + 1);
  }

  const days: DayProtein[] = keys.map((key) => {
    const protein = proteinByDay.get(key) ?? 0;
    return {
      key,
      label: weekdayLetter(key),
      protein,
      hit: protein >= proteinTarget,
      logged: (mealCountByDay.get(key) ?? 0) > 0,
      isToday: key === todayKey,
    };
  });

  // Averages run over logged days: a mean over 3 of 7 days is a different
  // claim from a mean over 7, and dividing by 7 quietly understates it.
  const loggedDays = days.filter((d) => d.logged);
  const daysLogged = loggedDays.length;
  const weekAvg = daysLogged
    ? Math.round(loggedDays.reduce((a, d) => a + d.protein, 0) / daysLogged)
    : 0;
  const weekHits = loggedDays.filter((d) => d.hit).length;
  const avgKcal = daysLogged
    ? Math.round(loggedDays.reduce((a, d) => a + (kcalByDay.get(d.key) ?? 0), 0) / daysLogged)
    : 0;

  const windowMeals = meals.filter((m) => proteinByDay.has(wallDateKey(m.occurredAt)));
  const totalProtein = windowMeals.reduce((a, m) => a + (m.proteinG ?? 0), 0);
  const avgPerMeal = windowMeals.length ? Math.round(totalProtein / windowMeals.length) : 0;

  const counts = new Map<string, number>();
  for (const m of windowMeals) {
    const name = m.mealName?.trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let mostLogged: string | null = null;
  let best = 0;
  for (const [name, n] of counts) {
    if (n > best) {
      best = n;
      mostLogged = name;
    }
  }

  return {
    days,
    weekAvg,
    weekHits,
    daysLogged,
    avgPerMeal,
    avgKcal,
    mostLogged,
    paceMessage: paceMessage(days[days.length - 1].protein, nowIso, proteinTarget),
  };
}

/** Are you ahead of or behind where a steady day would put you by now? */
function paceMessage(todayProtein: number, nowIso: string, proteinTarget: number): string {
  const parts = wallParts(nowIso);
  const hour = parts ? parts.hour + parts.minute / 60 : 12;
  // Eating window ~06:00–22:00; clamp so pre-dawn/late-night stay sane.
  const dayFrac = Math.min(1, Math.max(0.05, (hour - 6) / 16));
  const expected = Math.round(proteinTarget * dayFrac);
  const diff = todayProtein - expected;
  const left = Math.max(0, proteinTarget - todayProtein);
  if (diff >= 0) {
    return `You're ${diff}g ahead of pace for this time of day. On track for ${proteinTarget}g.`;
  }
  return `You're ${Math.abs(diff)}g behind pace. A high-protein meal (~${Math.min(left, 52)}g) gets you back on track.`;
}
