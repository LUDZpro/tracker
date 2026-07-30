/**
 * Pure aggregations over a WeekResponse's events for the desktop 7-day
 * column and goal cards. Day attribution is by wall date; nights belong
 * to the day they *end* on (the wake day), matching how a "last night"
 * reads on a daily dashboard.
 */
import { buildSleepPairs } from './sleep';
import { minutesBetween, shiftDateKey, wallDateKey, wallHHMM, wallMinutes } from './time';
import type { AppEvent } from './types';

// Thresholds live in lib/goals.ts now; re-exported so existing importers keep
// resolving and so there is still exactly one definition of each.
export { CAFFEINE_CUTOFF_MIN, PROTEIN_TARGET_G } from './goals';

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

/** Gym sessions per day; 0 is a real answer here, so never null. */
export function gymCountByDay(
  events: readonly AppEvent[],
  dayKeys: readonly string[],
): number[] {
  const byDay = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'gym-session') continue;
    const key = wallDateKey(e.occurredAt);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  return dayKeys.map((k) => byDay.get(k) ?? 0);
}

/** Meals logged per day, used for the protein tooltip's composition rows. */
export function mealCountByDay(
  events: readonly AppEvent[],
  dayKeys: readonly string[],
): number[] {
  const byDay = new Map<string, number>();
  for (const e of events) {
    if (e.type !== 'meal') continue;
    const key = wallDateKey(e.occurredAt);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  return dayKeys.map((k) => byDay.get(k) ?? 0);
}

export interface SleepNight {
  /** Total slept minutes, or null when no pair closed on that day. */
  minutes: number | null;
  /** HH:MM the night began; null when unknown. */
  from: string | null;
  /** HH:MM the night ended; null when unknown. */
  to: string | null;
}

/**
 * Sleep with its bed and wake clock times, so a chart tooltip can answer
 * "when did that night actually run?" without opening the ledger.
 */
export function sleepNightsByDay(
  events: readonly AppEvent[],
  dayKeys: readonly string[],
): SleepNight[] {
  const byDay = new Map<string, SleepNight>();
  for (const pair of buildSleepPairs(events)) {
    const key = wallDateKey(pair.end.occurredAt);
    const mins = minutesBetween(pair.start.occurredAt, pair.end.occurredAt);
    if (mins <= 0) continue;
    const prior = byDay.get(key);
    byDay.set(key, {
      minutes: (prior?.minutes ?? 0) + mins,
      from: prior?.from ?? wallHHMM(pair.start.occurredAt),
      to: wallHHMM(pair.end.occurredAt),
    });
  }
  return dayKeys.map((k) => byDay.get(k) ?? { minutes: null, from: null, to: null });
}

/** "7h 45m" — the form used inside charts and tooltips. */
export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

/** Full weekday + day-of-month for a tooltip heading: "Sun 24 Jul". */
export function dayLabel(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
