/**
 * Pure aggregations over a WeekResponse's events for the desktop 7-day
 * column and goal cards. Day attribution is by wall date; nights belong
 * to the day they *end* on (the wake day), matching how a "last night"
 * reads on a daily dashboard.
 */
import { buildSleepPairs } from './sleep';
import { minutesBetween, shiftDateKey, wallDateKey, wallHHMM, wallMinutes } from './time';
import type { AppEvent } from './types';

export const PROTEIN_TARGET_G = 160;
export const CAFFEINE_CUTOFF_MIN = 16 * 60;

/** The n calendar-day keys ending at todayKey, ascending (oldest first). */
export function lastNDayKeys(todayKey: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shiftDateKey(todayKey, i - (n - 1)));
}

/** Narrow weekday letter for a YYYY-MM-DD key ("M", "T", …). */
export function dayLetter(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'narrow' });
}

/** Total slept minutes per day (night attributed to its wake day); null = no pair. */
export function sleepMinutesByDay(
  events: readonly AppEvent[],
  dayKeys: readonly string[],
): (number | null)[] {
  const byDay = new Map<string, number>();
  for (const pair of buildSleepPairs(events)) {
    const key = wallDateKey(pair.end.occurredAt);
    const mins = minutesBetween(pair.start.occurredAt, pair.end.occurredAt);
    if (mins > 0) byDay.set(key, (byDay.get(key) ?? 0) + mins);
  }
  return dayKeys.map((k) => byDay.get(k) ?? null);
}

/** Mean intensity (1–5) per day for mood or energy; null = not logged. */
export function intensityAvgByDay(
  events: readonly AppEvent[],
  dayKeys: readonly string[],
  type: 'mood' | 'energy',
): (number | null)[] {
  const sums = new Map<string, { total: number; n: number }>();
  for (const e of events) {
    if (e.type !== type || e.intensity === undefined) continue;
    const key = wallDateKey(e.occurredAt);
    const slot = sums.get(key) ?? { total: 0, n: 0 };
    sums.set(key, { total: slot.total + e.intensity, n: slot.n + 1 });
  }
  return dayKeys.map((k) => {
    const s = sums.get(k);
    return s ? s.total / s.n : null;
  });
}

export interface CaffeineDay {
  /** Wall minutes of each intake, ascending. */
  minutes: number[];
  /** HH:MM of the last intake; null when none. */
  last: string | null;
}

/** Caffeine intakes per day; consumers compare against CAFFEINE_CUTOFF_MIN. */
export function caffeineByDay(
  events: readonly AppEvent[],
  dayKeys: readonly string[],
): CaffeineDay[] {
  return dayKeys.map((key) => {
    const day = events
      .filter((e) => e.type === 'caffeine' && wallDateKey(e.occurredAt) === key)
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
    const lastEvent = day[day.length - 1];
    return {
      minutes: day.map((e) => wallMinutes(e.occurredAt)),
      last: lastEvent ? wallHHMM(lastEvent.occurredAt) : null,
    };
  });
}

/** Grams of protein per day summed across that day's meals. */
export function proteinByDay(
  events: readonly AppEvent[],
  dayKeys: readonly string[],
): number[] {
  const byDay = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'meal' || e.proteinG === undefined) continue;
    const key = wallDateKey(e.occurredAt);
    byDay.set(key, (byDay.get(key) ?? 0) + e.proteinG);
  }
  return dayKeys.map((k) => byDay.get(k) ?? 0);
}

/** "7 h 31" style duration; minutes-only under an hour. */
export function formatHhMm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}
