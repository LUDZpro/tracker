/**
 * Grouping sleep episodes into the rows the report renders, under either of
 * the two day conventions the reader can switch between.
 *
 * `night` is the sleep-medicine convention: a day runs noon→noon, so a night
 * and the morning it ends in stay on one row. It never cuts a sleep in half,
 * but the row is named for the day the night *began* — a 00:07 onset on 2 Aug
 * belongs to the row labelled 1 Aug, which reads as a wrong date unless the
 * label says so outright.
 *
 * `calendar` is the everyday convention: a day runs midnight→midnight and a
 * row holds exactly the sleep that happened on that date. Nothing is
 * mislabelled, but a sleep crossing midnight is split between two rows.
 *
 * Neither convention is more correct — they answer different questions — so
 * the report offers both rather than quietly picking one.
 */
import { shiftDateKey, wallDateKey } from '../time';
import { reportDayKey } from './episodes';
import type { Confidence, SleepEpisode } from './types';

export type DayMode = 'night' | 'calendar';

/** The hour each mode starts its day at. */
export const DAY_MODE_ANCHOR_HOUR: Record<DayMode, number> = {
  night: 12,
  calendar: 0,
};

const DAY_MINUTES = 1440;

/**
 * One day's share of a sleep episode.
 *
 * In `night` mode a segment is always a whole episode. In `calendar` mode an
 * episode crossing midnight contributes one segment to each date it touches,
 * and the `clipped*` flags mark the edges that are a cut rather than a real
 * onset or wake — without them a segment starting at 00:00 would be read as
 * "fell asleep at midnight".
 */
export interface DaySegment {
  /** The parent episode's true onset, regardless of where this segment cuts. */
  startIso: string;
  /** The parent episode's true wake. */
  endIso: string;
  /** Wall minutes of this segment's own edges. A clipped edge sits on midnight. */
  startMinutes: number;
  endMinutes: number;
  /** Minutes of sleep credited to this day. */
  minutes: number;
  /** The episode began before this day — `startMinutes` is a cut, not an onset. */
  clippedStart: boolean;
  /** The episode runs past this day — `endMinutes` is a cut, not a wake. */
  clippedEnd: boolean;
  confidence: Confidence;
}

export interface DayRow {
  dayKey: string;
  /** Chronological, always at least one. */
  segments: DaySegment[];
  /** Every segment summed — the day's actual time asleep. */
  totalMinutes: number;
  /** The longest segment; ties resolve to the earlier one. */
  main: DaySegment;
  /** Everything except `main`, chronological. */
  extras: DaySegment[];
}

type Placed = { dayKey: string; segment: DaySegment };

/** The whole episode, uncut, on the noon-anchored day its onset belongs to. */
function nightSegments(e: SleepEpisode): Placed[] {
  return [
    {
      dayKey: reportDayKey(e.startIso, DAY_MODE_ANCHOR_HOUR.night),
      segment: {
        startIso: e.startIso,
        endIso: e.endIso,
        startMinutes: e.startMinutes,
        endMinutes: e.endMinutes,
        minutes: e.durationMinutes,
        clippedStart: false,
        clippedEnd: false,
        confidence: e.confidence,
      },
    },
  ];
}

/** The episode cut at every midnight it crosses. */
function calendarSegments(e: SleepEpisode): Placed[] {
  const out: Placed[] = [];
  let dayKey = wallDateKey(e.startIso);
  let from = e.startMinutes;
  let remaining = Math.max(0, e.durationMinutes);

  // Bounded: a span is validated at 16 h, but a corrupt row must not spin.
  for (let guard = 0; guard < 40 && remaining > 0; guard += 1) {
    const take = Math.min(DAY_MINUTES - from, remaining);
    out.push({
      dayKey,
      segment: {
        startIso: e.startIso,
        endIso: e.endIso,
        startMinutes: from,
        endMinutes: from + take,
        minutes: take,
        clippedStart: out.length > 0,
        clippedEnd: take < remaining,
        confidence: e.confidence,
      },
    });
    remaining -= take;
    dayKey = shiftDateKey(dayKey, 1);
    from = 0;
  }

  return out;
}

/**
 * One row per day that carries sleep, ascending. Days with no sleep are
 * absent by design — the charts pad against `rangeKeys` when they need a
 * continuous axis, and the table should not list empty rows.
 */
export function buildDayRows(
  episodes: readonly SleepEpisode[],
  mode: DayMode,
): DayRow[] {
  const split = mode === 'calendar' ? calendarSegments : nightSegments;
  const byDay = new Map<string, DaySegment[]>();

  for (const e of episodes) {
    for (const { dayKey, segment } of split(e)) {
      if (segment.minutes <= 0) continue;
      const list = byDay.get(dayKey);
      if (list) list.push(segment);
      else byDay.set(dayKey, [segment]);
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([dayKey, collected]) => {
      // Episodes arrive chronologically, so insertion order is already right;
      // sorting explicitly keeps that from being a silent dependency.
      const segments = [...collected].sort(
        (a, b) => Date.parse(a.startIso) - Date.parse(b.startIso),
      );

      let main = segments[0];
      for (const s of segments) {
        if (s.minutes > main.minutes) main = s;
      }

      return {
        dayKey,
        segments,
        totalMinutes: segments.reduce((sum, s) => sum + s.minutes, 0),
        main,
        extras: segments.filter((s) => s !== main),
      };
    });
}

/** The last calendar date a row reaches into — the morning of a night row. */
export function dayRowEndKey(dayKey: string, mode: DayMode): string {
  return mode === 'night' ? shiftDateKey(dayKey, 1) : dayKey;
}
