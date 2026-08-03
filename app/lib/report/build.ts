/**
 * Composes the whole report from the raw event log.
 *
 * Runs on the client from the `/api/report` payload — the dataset is a few
 * hundred events, so shipping the log and deriving in the browser keeps the
 * route dumb and makes every number here reproducible from data the page
 * already holds.
 */
import { wallDateKey } from '../time';
import type { AppEvent } from '../types';
import { buildActogram, type ActogramRow } from './actogram';
import { buildDayRows, DAY_MODE_ANCHOR_HOUR, type DayMode, type DayRow } from './days';
import {
  buildEpisodes,
  buildNaps,
  buildRatings,
  buildTimedPoints,
  countByDay,
  coverageBlocks,
  reportDayKey,
} from './episodes';
import {
  recordRange,
  sleepRegularityIndex,
  summariseConfidence,
  summariseFragmentation,
  summariseIntake,
  summariseSleep,
  type ConfidenceSummary,
  type FragmentationSummary,
  type IntakeSummary,
  type RegularityResult,
  type SleepSummary,
} from './summary';
import type {
  CoverageBlock,
  DayCount,
  NapRecord,
  RatingPoint,
  SleepEpisode,
  TimedPoint,
} from './types';

export interface ReportMeta {
  fromKey: string;
  toKey: string;
  generatedIso: string;
  /** Calendar days spanned, gaps included. */
  spanDays: number;
  /** Days carrying at least one event. */
  trackedDays: number;
  blocks: CoverageBlock[];
  /** Distinct timezone offsets seen in the log — >1 means an import seam. */
  offsets: string[];
}

export interface ReportData {
  meta: ReportMeta;
  /** Which day convention every row, chart and label below was built under. */
  dayMode: DayMode;
  rangeKeys: string[];
  episodes: SleepEpisode[];
  /** One row per day carrying sleep, ascending. */
  days: DayRow[];
  naps: NapRecord[];
  actogram: ActogramRow[];
  sleep: SleepSummary;
  fragmentation: FragmentationSummary;
  intake: IntakeSummary;
  confidence: ConfidenceSummary;
  regularity: RegularityResult;
  mealsPerDay: DayCount[];
  caffeinePerDay: DayCount[];
  mealPoints: TimedPoint[];
  caffeinePoints: TimedPoint[];
  mood: RatingPoint[];
  energy: RatingPoint[];
  /** First day carrying a meal — intake tracking started later than sleep. */
  mealTrackingFromKey: string | null;
  caffeineTrackingFromKey: string | null;
}

const EMPTY_META: ReportMeta = {
  fromKey: '',
  toKey: '',
  generatedIso: '',
  spanDays: 0,
  trackedDays: 0,
  blocks: [],
  offsets: [],
};

function offsetOf(iso: string): string {
  const m = iso.slice(10).match(/(Z|[+-]\d{2}:\d{2})$/);
  return m ? m[1] : 'none';
}

/** The empty document, so the page renders its shell before data arrives. */
export function emptyReport(mode: DayMode = 'night'): ReportData {
  return {
    meta: EMPTY_META,
    dayMode: mode,
    rangeKeys: [],
    episodes: [],
    days: [],
    naps: [],
    actogram: [],
    sleep: summariseSleep([]),
    fragmentation: summariseFragmentation([], [], []),
    intake: summariseIntake([], [], []),
    confidence: summariseConfidence([]),
    regularity: { sri: null, comparisons: 0 },
    mealsPerDay: [],
    caffeinePerDay: [],
    mealPoints: [],
    caffeinePoints: [],
    mood: [],
    energy: [],
    mealTrackingFromKey: null,
    caffeineTrackingFromKey: null,
  };
}

export function buildReport(
  events: readonly AppEvent[],
  generatedIso: string,
  mode: DayMode = 'night',
): ReportData {
  const anchorHour = DAY_MODE_ANCHOR_HOUR[mode];
  const empty = { ...emptyReport(mode), meta: { ...EMPTY_META, generatedIso } };
  if (events.length === 0) return empty;

  const eventDayKeys = events.map((e) => wallDateKey(e.occurredAt));
  const range = recordRange(eventDayKeys);
  if (!range) return empty;

  const coveredKeys = new Set(eventDayKeys);
  const rangeKeys = range.keys;

  const episodes = buildEpisodes(events, anchorHour);
  const days = buildDayRows(episodes, mode);
  const naps = buildNaps(events);
  const mealPoints = buildTimedPoints(events, 'meal', (e) => e.mealName ?? 'Meal');
  const caffeinePoints = buildTimedPoints(events, 'caffeine', (e) => e.kind ?? 'other');

  // Intake tracking began well after sleep tracking. Averaging meals over the
  // whole record would silently report months of "zero meals a day".
  const mealTrackingFromKey = mealPoints.length ? mealPoints[0].dayKey : null;
  const caffeineTrackingFromKey = caffeinePoints.length ? caffeinePoints[0].dayKey : null;

  const mealWindowKeys = mealTrackingFromKey
    ? rangeKeys.filter((k) => k >= mealTrackingFromKey && coveredKeys.has(k))
    : [];
  const caffeineWindowKeys = caffeineTrackingFromKey
    ? rangeKeys.filter((k) => k >= caffeineTrackingFromKey && coveredKeys.has(k))
    : [];

  return {
    meta: {
      fromKey: range.fromKey,
      toKey: range.toKey,
      generatedIso,
      spanDays: rangeKeys.length,
      trackedDays: coveredKeys.size,
      blocks: coverageBlocks([...coveredKeys]),
      offsets: [...new Set(events.map((e) => offsetOf(e.occurredAt)))].sort(),
    },
    dayMode: mode,
    rangeKeys,
    episodes,
    days,
    naps,
    actogram: buildActogram(episodes, rangeKeys, coveredKeys, anchorHour),
    sleep: summariseSleep(days),
    fragmentation: summariseFragmentation(days, episodes, naps),
    intake: summariseIntake(caffeinePoints, mealPoints, mealWindowKeys),
    confidence: summariseConfidence(episodes),
    regularity: sleepRegularityIndex(episodes, coveredKeys, rangeKeys),
    // Intake points already carry their calendar day, so the bars and the
    // timing scatter below them can never disagree about which day is which.
    mealsPerDay: countByDay(mealPoints, mealWindowKeys, coveredKeys),
    caffeinePerDay: countByDay(caffeinePoints, caffeineWindowKeys, coveredKeys),
    mealPoints,
    caffeinePoints,
    mood: buildRatings(events, 'mood'),
    energy: buildRatings(events, 'energy'),
    mealTrackingFromKey,
    caffeineTrackingFromKey,
  };
}

export { reportDayKey };
export { DAY_MODE_ANCHOR_HOUR, dayRowEndKey, type DayMode, type DayRow, type DaySegment } from './days';
