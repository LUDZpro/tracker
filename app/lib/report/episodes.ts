/**
 * Turns the raw event log into the sleep episodes the report reasons about.
 *
 * Pairing reuses `buildSleepPairs` so the report can never disagree with the
 * rest of the app about what counts as a night. Everything added here is
 * report-specific: the noon anchor, main-vs-fragment, and the confidence
 * tier that keeps reconstructed April data visually distinct from July's
 * minute-accurate logs.
 */
import { buildSleepPairs, sortByTime } from '../sleep';
import { shiftDateKey, wallDateKey, wallMinutes, wallMinutesBetween } from '../time';
import type { AppEvent } from '../types';
import type {
  Confidence,
  CoverageBlock,
  DayCount,
  NapRecord,
  RatingPoint,
  SleepEpisode,
  TimedPoint,
} from './types';

/** Hour that starts a reporting day. Noon is the actogram convention. */
export const DAY_ANCHOR_HOUR = 12;

/**
 * The reporting day an instant belongs to. Anything before noon is credited
 * to the previous calendar day, so a night and its morning stay on one row
 * instead of being split across two.
 */
export function reportDayKey(iso: string, anchorHour = DAY_ANCHOR_HOUR): string {
  const key = wallDateKey(iso);
  return wallMinutes(iso) < anchorHour * 60 ? shiftDateKey(key, -1) : key;
}

/** Map a stored `precision` value onto a confidence tier. */
export function confidenceOf(precision: string | null | undefined): Confidence {
  if (precision === 'synthetic') return 'reconstructed';
  if (precision === '~hour' || precision === '~part_of_day') return 'approximate';
  return 'logged';
}

/** The weaker of two tiers — a span is only as good as its vaguer end. */
function weakest(a: Confidence, b: Confidence): Confidence {
  const rank: Record<Confidence, number> = {
    logged: 0,
    approximate: 1,
    reconstructed: 2,
  };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Every completed sleep span, tagged with its reporting day and marked
 * `main` (the longest of its day) or `fragment`.
 */
export function buildEpisodes(events: readonly AppEvent[]): SleepEpisode[] {
  const episodes = buildSleepPairs(events).map((pair) => {
    const startIso = pair.start.occurredAt;
    const endIso = pair.end.occurredAt;
    return {
      startIso,
      endIso,
      dayKey: reportDayKey(startIso),
      startMinutes: wallMinutes(startIso),
      endMinutes: wallMinutes(endIso),
      durationMinutes: wallMinutesBetween(startIso, endIso),
      kind: 'fragment' as const,
      confidence: weakest(
        confidenceOf(pair.start.precision),
        confidenceOf(pair.end.precision),
      ),
    };
  });

  const longestByDay = new Map<string, number>();
  for (const e of episodes) {
    const best = longestByDay.get(e.dayKey);
    if (best === undefined || e.durationMinutes > best) {
      longestByDay.set(e.dayKey, e.durationMinutes);
    }
  }

  // A day's longest span is its main sleep; ties resolve to the earlier one
  // so exactly one episode per day is ever promoted.
  const claimed = new Set<string>();
  return episodes.map((e) => {
    const isLongest = longestByDay.get(e.dayKey) === e.durationMinutes;
    if (isLongest && !claimed.has(e.dayKey)) {
      claimed.add(e.dayKey);
      return { ...e, kind: 'main' as const };
    }
    return e;
  });
}

/** Explicitly logged naps. Distinct from short sleep fragments by design. */
export function buildNaps(events: readonly AppEvent[]): NapRecord[] {
  return sortByTime(events)
    .filter((e) => e.type === 'nap')
    .map((e) => ({
      atIso: e.occurredAt,
      dayKey: reportDayKey(e.occurredAt),
      startMinutes: wallMinutes(e.occurredAt),
      durationMinutes: typeof e.duration === 'number' ? e.duration : null,
      confidence: confidenceOf(e.precision),
    }));
}

/** Point events of one type, placed on the clock. */
export function buildTimedPoints(
  events: readonly AppEvent[],
  type: AppEvent['type'],
  label: (e: AppEvent) => string,
): TimedPoint[] {
  return sortByTime(events)
    .filter((e) => e.type === type)
    .map((e) => ({
      atIso: e.occurredAt,
      dayKey: reportDayKey(e.occurredAt),
      minutes: wallMinutes(e.occurredAt),
      label: label(e),
    }));
}

/** 1–5 self-ratings of one type, in order. */
export function buildRatings(
  events: readonly AppEvent[],
  type: 'mood' | 'energy',
): RatingPoint[] {
  return sortByTime(events)
    .filter((e) => e.type === type && typeof e.intensity === 'number')
    .map((e) => ({
      atIso: e.occurredAt,
      dayKey: reportDayKey(e.occurredAt),
      minutes: wallMinutes(e.occurredAt),
      value: e.intensity as number,
    }));
}

/** Inclusive list of calendar day keys from `fromKey` to `toKey`. */
export function dayRange(fromKey: string, toKey: string): string[] {
  const keys: string[] = [];
  let cursor = fromKey;
  // Bounded so a reversed or malformed range can never spin.
  for (let i = 0; i < 5000 && cursor <= toKey; i += 1) {
    keys.push(cursor);
    cursor = shiftDateKey(cursor, 1);
  }
  return keys;
}

/**
 * Per-day counts across the whole range, including zeros. `covered` marks
 * days inside a tracking block, so a chart can distinguish "ate nothing"
 * from "was not tracking" — the distinction the June gap makes unavoidable.
 */
export function countByDay(
  points: readonly { dayKey: string }[],
  rangeKeys: readonly string[],
  coveredKeys: ReadonlySet<string>,
): DayCount[] {
  const counts = new Map<string, number>();
  for (const p of points) {
    counts.set(p.dayKey, (counts.get(p.dayKey) ?? 0) + 1);
  }
  return rangeKeys.map((dayKey) => ({
    dayKey,
    count: counts.get(dayKey) ?? 0,
    covered: coveredKeys.has(dayKey),
  }));
}

/**
 * Contiguous stretches of days carrying at least one event. A gap of more
 * than `maxGapDays` empty days splits the record into separate blocks, which
 * is how the June pause becomes a visible break rather than a flat line.
 */
export function coverageBlocks(
  dayKeys: readonly string[],
  maxGapDays = 2,
): CoverageBlock[] {
  const sorted = [...new Set(dayKeys)].sort();
  const blocks: CoverageBlock[] = [];
  let from: string | null = null;
  let prev: string | null = null;

  for (const key of sorted) {
    if (from === null || prev === null) {
      from = key;
      prev = key;
      continue;
    }
    const gap = dayRange(prev, key).length - 1;
    if (gap > maxGapDays) {
      blocks.push({ fromKey: from, toKey: prev, days: dayRange(from, prev).length });
      from = key;
    }
    prev = key;
  }
  if (from !== null && prev !== null) {
    blocks.push({ fromKey: from, toKey: prev, days: dayRange(from, prev).length });
  }
  return blocks;
}
