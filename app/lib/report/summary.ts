/**
 * The numbers at the top of the report.
 *
 * Everything here is descriptive: counts, averages, spreads. Nothing in this
 * module infers a diagnosis or a cause, because the reader is a clinician and
 * that inference is theirs to make.
 */
import { wallDateKey } from '../time';
import {
  circularClockStat,
  mean,
  nightAxisMinutes,
  type ClockStat,
} from './clockStats';
import type { DayRow } from './days';
import { dayRange } from './episodes';
import type { Confidence, NapRecord, SleepEpisode, TimedPoint } from './types';

/** Onsets at or after this clock time count as "very late". */
export const LATE_ONSET_HOUR = 3;
/** Caffeine at or after this hour counts as late-day intake. */
export const CAFFEINE_LATE_HOUR = 15;
/** A meal in [00:00, this hour) counts as overnight eating. */
export const NIGHT_EATING_END_HOUR = 7;
/** Evening sleep: an onset in this window that runs short. */
const EVENING_WINDOW = { fromHour: 17, toHour: 24, maxMinutes: 6 * 60 };
/** Grid resolution for the regularity index. */
const SRI_STEP_MINUTES = 5;

export interface SleepSummary {
  /** Rows that carry sleep — nights or calendar days, per the active mode. */
  days: number;
  onset: ClockStat | null;
  wake: ClockStat | null;
  /** Mean of each day's *total* sleep, fragments included. */
  meanTotalMinutes: number | null;
  /** Mean of each day's longest single episode. */
  meanMainMinutes: number | null;
  lateOnsetDays: number;
  /** Days contributing a real onset — the denominator for `lateOnsetDays`. */
  onsetDays: number;
  longestTotalMinutes: number | null;
  shortestTotalMinutes: number | null;
}

export interface FragmentationSummary {
  totalEpisodes: number;
  fragmentedDays: number;
  eveningEpisodes: number;
  naps: number;
  meanNapMinutes: number | null;
}

export interface IntakeSummary {
  caffeineDoses: number;
  caffeineLate: number;
  meals: number;
  nightMeals: number;
  mealDaysCovered: number;
  meanMealsPerDay: number | null;
}

export interface ConfidenceSummary {
  logged: number;
  approximate: number;
  reconstructed: number;
}

/**
 * Per-day sleep statistics.
 *
 * Durations are reported twice on purpose. `meanMainMinutes` is the classic
 * main-sleep-period figure; `meanTotalMinutes` counts every episode of the
 * day. On a fragmented record the two diverge sharply — 2 Aug 2026 held 16 h
 * of sleep across three episodes, of which the longest was 6 h 37 — and
 * showing only the first understates the record badly.
 *
 * Onset and wake stats skip edges that a calendar-mode midnight cut created:
 * a segment starting at 00:00 because the sleep began the evening before is
 * not an onset, and averaging it in would drag every clock statistic toward
 * midnight.
 */
export function summariseSleep(rows: readonly DayRow[]): SleepSummary {
  const totals = rows.map((r) => r.totalMinutes);
  const mains = rows.map((r) => r.main);
  const realOnsets = mains.filter((s) => !s.clippedStart);
  const realWakes = mains.filter((s) => !s.clippedEnd);

  return {
    days: rows.length,
    onset: circularClockStat(realOnsets.map((s) => s.startMinutes)),
    wake: circularClockStat(realWakes.map((s) => s.endMinutes)),
    meanTotalMinutes: mean(totals),
    meanMainMinutes: mean(mains.map((s) => s.minutes)),
    lateOnsetDays: realOnsets.filter(
      (s) => nightAxisMinutes(s.startMinutes) >= (24 + LATE_ONSET_HOUR) * 60,
    ).length,
    onsetDays: realOnsets.length,
    longestTotalMinutes: totals.length ? Math.max(...totals) : null,
    shortestTotalMinutes: totals.length ? Math.min(...totals) : null,
  };
}

/**
 * How broken up the sleep is. Episode-level figures come from the episodes
 * themselves rather than day segments, so a sleep split across midnight in
 * calendar mode still counts once.
 */
export function summariseFragmentation(
  rows: readonly DayRow[],
  episodes: readonly SleepEpisode[],
  naps: readonly NapRecord[],
): FragmentationSummary {
  const napDurations = naps
    .map((n) => n.durationMinutes)
    .filter((d): d is number => d !== null);

  return {
    totalEpisodes: episodes.length,
    fragmentedDays: rows.filter((r) => r.segments.length > 1).length,
    eveningEpisodes: episodes.filter(
      (e) =>
        e.startMinutes >= EVENING_WINDOW.fromHour * 60 &&
        e.startMinutes < EVENING_WINDOW.toHour * 60 &&
        e.durationMinutes < EVENING_WINDOW.maxMinutes,
    ).length,
    naps: naps.length,
    meanNapMinutes: mean(napDurations),
  };
}

/** Caffeine and meal counts, with the two timing flags a clinician asks about. */
export function summariseIntake(
  caffeine: readonly TimedPoint[],
  meals: readonly TimedPoint[],
  mealDayKeys: readonly string[],
): IntakeSummary {
  const mealDaysCovered = new Set(mealDayKeys).size;
  return {
    caffeineDoses: caffeine.length,
    caffeineLate: caffeine.filter((c) => c.minutes >= CAFFEINE_LATE_HOUR * 60).length,
    meals: meals.length,
    nightMeals: meals.filter((m) => m.minutes < NIGHT_EATING_END_HOUR * 60).length,
    mealDaysCovered,
    meanMealsPerDay: mealDaysCovered > 0 ? meals.length / mealDaysCovered : null,
  };
}

/** How much of the record is directly logged versus rebuilt after the fact. */
export function summariseConfidence(
  episodes: readonly SleepEpisode[],
): ConfidenceSummary {
  const counts: ConfidenceSummary = { logged: 0, approximate: 0, reconstructed: 0 };
  for (const e of episodes) {
    counts[e.confidence as Confidence] += 1;
  }
  return counts;
}

export interface RegularityResult {
  /**
   * Sleep Regularity Index, −100 to 100. The percentage of paired time points
   * 24 h apart in the same state (asleep/awake), rescaled. Around 75–85 is
   * typical for a settled schedule; near 0 means the state at any clock time
   * says nothing about the state a day later.
   */
  sri: number | null;
  /** Comparisons that contributed — both ends had to fall on tracked days. */
  comparisons: number;
}

/**
 * Sleep Regularity Index over the tracked range.
 *
 * Days with no data are excluded from both ends of every comparison. Without
 * that, an untracked stretch reads as a long uninterrupted "awake" and scores
 * as near-perfect regularity, which would be the exact opposite of the truth.
 */
export function sleepRegularityIndex(
  episodes: readonly SleepEpisode[],
  coveredKeys: ReadonlySet<string>,
  rangeKeys: readonly string[],
): RegularityResult {
  if (rangeKeys.length < 2) return { sri: null, comparisons: 0 };

  const slotsPerDay = (24 * 60) / SRI_STEP_MINUTES;
  const dayIndex = new Map(rangeKeys.map((key, i) => [key, i]));
  const totalSlots = rangeKeys.length * slotsPerDay;
  const asleep = new Uint8Array(totalSlots);

  for (const e of episodes) {
    const startDay = dayIndex.get(wallDateKey(e.startIso));
    if (startDay === undefined) continue;
    const from = startDay * slotsPerDay + Math.floor(e.startMinutes / SRI_STEP_MINUTES);
    const span = Math.max(0, Math.round(e.durationMinutes / SRI_STEP_MINUTES));
    for (let i = from; i < Math.min(from + span, totalSlots); i += 1) {
      asleep[i] = 1;
    }
  }

  const covered = rangeKeys.map((key) => coveredKeys.has(key));
  let concordant = 0;
  let comparisons = 0;

  for (let i = 0; i + slotsPerDay < totalSlots; i += 1) {
    const dayA = Math.floor(i / slotsPerDay);
    const dayB = Math.floor((i + slotsPerDay) / slotsPerDay);
    if (!covered[dayA] || !covered[dayB]) continue;
    comparisons += 1;
    if (asleep[i] === asleep[i + slotsPerDay]) concordant += 1;
  }

  if (comparisons === 0) return { sri: null, comparisons: 0 };
  return { sri: (200 * concordant) / comparisons - 100, comparisons };
}

/** Calendar days touched by any of the supplied day keys, as a set. */
export function coveredDayKeys(dayKeys: readonly string[]): Set<string> {
  return new Set(dayKeys);
}

/** Inclusive calendar span of the whole record. */
export function recordRange(dayKeys: readonly string[]): {
  fromKey: string;
  toKey: string;
  keys: string[];
} | null {
  if (dayKeys.length === 0) return null;
  const sorted = [...dayKeys].sort();
  const fromKey = sorted[0];
  const toKey = sorted[sorted.length - 1];
  return { fromKey, toKey, keys: dayRange(fromKey, toKey) };
}
