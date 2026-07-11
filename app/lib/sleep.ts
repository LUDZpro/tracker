import { minutesBetween, wallDateKey, wallMinutes, shiftDateKey } from './time';
import { SLEEP_SPAN_MAX_MINUTES, SLEEP_SPAN_MIN_MINUTES } from './validation';
import type { AppEvent, SleepPair } from './types';

/** Sort events chronologically (ascending). Returns a new array. */
export function sortByTime(events: readonly AppEvent[]): AppEvent[] {
  return [...events].sort(
    (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
  );
}

/**
 * Pair sleep markers: each sleep_start closes with the next wake_up.
 * Consecutive duplicates (sleep,sleep or wake,wake) leave the extra marker
 * unpaired — that situation is surfaced to the user, never silently merged.
 */
export function buildSleepPairs(events: readonly AppEvent[]): SleepPair[] {
  const markers = sortByTime(events).filter((e) => e.category === 'marker');
  const pairs: SleepPair[] = [];
  let open: AppEvent | null = null;
  for (const m of markers) {
    if (m.type === 'sleep_start') {
      open = m; // a later sleep_start supersedes an unclosed one
    } else if (m.type === 'wake_up' && open) {
      pairs.push({ start: open, end: m });
      open = null;
    }
  }
  return pairs;
}

/** awake/asleep from the most recent marker; no markers ⇒ awake. */
export function currentState(events: readonly AppEvent[]): 'awake' | 'asleep' {
  const markers = sortByTime(events).filter((e) => e.category === 'marker');
  const last = markers[markers.length - 1];
  return last?.type === 'sleep_start' ? 'asleep' : 'awake';
}

/** Events at or after the last wake_up (or since local midnight if none). */
export function wakeWindowEvents(
  events: readonly AppEvent[],
  nowIso: string,
): AppEvent[] {
  const sorted = sortByTime(events);
  const lastWake = [...sorted].reverse().find((e) => e.type === 'wake_up');
  const windowStart = lastWake
    ? Date.parse(lastWake.occurredAt)
    : Date.parse(`${wallDateKey(nowIso)}T00:00:00${nowIso.slice(19)}`);
  return sorted.filter((e) => Date.parse(e.occurredAt) >= windowStart);
}

export interface WakeWindow {
  events: AppEvent[];
  /** The wake_up that opens the window; null only for offset 0 with no wake yet. */
  anchor: AppEvent | null;
  /** The sleep pair that ended at the anchor (the night before this window). */
  pair: SleepPair | null;
}

/**
 * The wake-window `offset` windows back (0 = current). Windows are delimited
 * by wake_up markers: window k spans [wake(n−k), wake(n−k+1)). Returns null
 * when history doesn't reach that far back.
 */
export function wakeWindowAt(
  events: readonly AppEvent[],
  nowIso: string,
  offset: number,
): WakeWindow | null {
  if (offset === 0) {
    const sorted = sortByTime(events);
    const anchor = [...sorted].reverse().find((e) => e.type === 'wake_up') ?? null;
    const pair =
      (anchor && buildSleepPairs(events).find((p) => p.end.id === anchor.id)) || null;
    return { events: wakeWindowEvents(events, nowIso), anchor, pair };
  }

  const wakes = sortByTime(events).filter((e) => e.type === 'wake_up');
  const i = wakes.length - 1 - offset;
  if (i < 0) return null;
  const anchor = wakes[i];
  const end = Date.parse(wakes[i + 1].occurredAt);
  const start = Date.parse(anchor.occurredAt);
  const windowEvents = sortByTime(events).filter((e) => {
    const t = Date.parse(e.occurredAt);
    return t >= start && t < end;
  });
  const pair = buildSleepPairs(events).find((p) => p.end.id === anchor.id) ?? null;
  return { events: windowEvents, anchor, pair };
}

/** Most recent pair, or a dangling start/end when the pair is incomplete. */
export function lastSleep(events: readonly AppEvent[]): {
  start: AppEvent | null;
  end: AppEvent | null;
} {
  const pairs = buildSleepPairs(events);
  const lastPair = pairs[pairs.length - 1] ?? null;
  const markers = sortByTime(events).filter((e) => e.category === 'marker');
  const last = markers[markers.length - 1];
  if (last?.type === 'sleep_start') return { start: last, end: null };
  if (lastPair) return { start: lastPair.start, end: lastPair.end };
  if (last?.type === 'wake_up') return { start: null, end: last };
  return { start: null, end: null };
}

/**
 * Mornings (wall dates) in the last 3 nights lacking a complete sleep pair.
 * A morning is covered when some pair's wake_up falls on that date.
 * Today is excluded while the user is still asleep.
 */
export function missingNights(
  events: readonly AppEvent[],
  nowIso: string,
): string[] {
  const covered = new Set(
    buildSleepPairs(events).map((p) => wallDateKey(p.end.occurredAt)),
  );
  const today = wallDateKey(nowIso);
  const asleep = currentState(events) === 'asleep';
  const candidates = [0, 1, 2]
    .map((n) => shiftDateKey(today, -n))
    .filter((d) => !(asleep && d === today));
  return candidates.filter((d) => !covered.has(d));
}

const NAP_WINDOW_START = 10 * 60; // 10:00
const NAP_WINDOW_END = 20 * 60; // 20:00
const NAP_MAX_SPAN_MINUTES = 3 * 60;

/** A completed pair that was probably a nap: <3h, or fully inside 10:00–20:00. */
export function looksLikeNap(pair: SleepPair): boolean {
  const span = minutesBetween(pair.start.occurredAt, pair.end.occurredAt);
  if (span < NAP_MAX_SPAN_MINUTES) return true;
  const s = wallMinutes(pair.start.occurredAt);
  const e = wallMinutes(pair.end.occurredAt);
  return (
    wallDateKey(pair.start.occurredAt) === wallDateKey(pair.end.occurredAt) &&
    s >= NAP_WINDOW_START &&
    e <= NAP_WINDOW_END
  );
}

export type SpanCheck = { ok: true } | { ok: false; error: string };

/** Ordering + 20min–16h span rule for a start/end pair. */
export function checkSleepSpan(startIso: string, endIso: string): SpanCheck {
  const span = minutesBetween(startIso, endIso);
  if (span <= 0) return { ok: false, error: 'sleep_start must be before wake_up' };
  if (span < SLEEP_SPAN_MIN_MINUTES) {
    return { ok: false, error: `Sleep span must be at least ${SLEEP_SPAN_MIN_MINUTES} minutes` };
  }
  if (span > SLEEP_SPAN_MAX_MINUTES) {
    return { ok: false, error: 'Sleep span must be at most 16 hours' };
  }
  return { ok: true };
}

/** True when [startIso, endIso] overlaps any existing pair (ids excluded). */
export function overlapsPairs(
  pairs: readonly SleepPair[],
  startIso: string,
  endIso: string,
  excludeIds: readonly string[] = [],
): boolean {
  const s = Date.parse(startIso);
  const e = Date.parse(endIso);
  return pairs.some((p) => {
    if (excludeIds.includes(p.start.id) || excludeIds.includes(p.end.id)) return false;
    const ps = Date.parse(p.start.occurredAt);
    const pe = Date.parse(p.end.occurredAt);
    return s < pe && e > ps;
  });
}
