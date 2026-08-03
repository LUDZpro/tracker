/**
 * Actogram geometry: one row per reporting day, noon to noon.
 *
 * Noon-anchored rows are the sleep-medicine convention because they keep a
 * night whole. On a midnight-anchored chart every ordinary night is cut in
 * two and the eye reads drift where there is none.
 */
import { wallDateKey, wallMinutes } from '../time';
import { DAY_ANCHOR_HOUR } from './episodes';
import type { Confidence, SleepEpisode } from './types';

const DAY_MINUTES = 1440;

export interface ActogramSpan {
  /** Minutes from the row's left edge (noon), 0–1440. */
  from: number;
  to: number;
  kind: SleepEpisode['kind'];
  confidence: Confidence;
}

export interface ActogramRow {
  dayKey: string;
  spans: ActogramSpan[];
  /** False when the day sits in a tracking gap — drawn as a void, not as awake. */
  covered: boolean;
}

/** Absolute wall minutes from the first day of the range. */
function absoluteMinutes(iso: string, dayIndex: ReadonlyMap<string, number>): number | null {
  const index = dayIndex.get(wallDateKey(iso));
  if (index === undefined) return null;
  return index * DAY_MINUTES + wallMinutes(iso);
}

/**
 * One row per key in `rangeKeys`, each carrying the sleep spans that fall in
 * its noon→noon window. Episodes crossing the boundary are clipped into both
 * rows rather than being dropped or duplicated whole.
 */
export function buildActogram(
  episodes: readonly SleepEpisode[],
  rangeKeys: readonly string[],
  coveredKeys: ReadonlySet<string>,
  anchorHour = DAY_ANCHOR_HOUR,
): ActogramRow[] {
  const dayIndex = new Map(rangeKeys.map((key, i) => [key, i]));
  const anchor = anchorHour * 60;

  const placed = episodes
    .map((e) => {
      const from = absoluteMinutes(e.startIso, dayIndex);
      if (from === null) return null;
      return { from, to: from + Math.max(0, e.durationMinutes), episode: e };
    })
    .filter((x): x is { from: number; to: number; episode: SleepEpisode } => x !== null);

  return rangeKeys.map((dayKey, i) => {
    const winStart = i * DAY_MINUTES + anchor;
    const winEnd = winStart + DAY_MINUTES;

    const spans: ActogramSpan[] = [];
    for (const p of placed) {
      const from = Math.max(p.from, winStart);
      const to = Math.min(p.to, winEnd);
      if (to > from) {
        spans.push({
          from: from - winStart,
          to: to - winStart,
          kind: p.episode.kind,
          confidence: p.episode.confidence,
        });
      }
    }

    return { dayKey, spans, covered: coveredKeys.has(dayKey) };
  });
}

/**
 * Hour ticks for the noon-anchored axis: 12, 15, 18 … 09, 12. Returned as
 * {atMinutes, label} so the chart never re-derives the wrap itself.
 */
export function actogramTicks(
  everyHours = 3,
  anchorHour = DAY_ANCHOR_HOUR,
): { atMinutes: number; label: string }[] {
  const ticks: { atMinutes: number; label: string }[] = [];
  for (let h = 0; h <= 24; h += everyHours) {
    ticks.push({
      atMinutes: h * 60,
      label: String((anchorHour + h) % 24).padStart(2, '0'),
    });
  }
  return ticks;
}
