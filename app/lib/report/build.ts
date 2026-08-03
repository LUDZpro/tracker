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

/** One night's main sleep, for the per-night charts and the appendix table. */
export interface NightRow {
  dayKey: string;
  onsetMinutes: number;
  wakeMinutes: number;
  durationMinutes: number;
  confidence: SleepEpisode['confidence'];
  /** Extra episodes on the same reporting day. */
  fragments: number;
}

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
  rangeKeys: string[];
  episodes: SleepEpisode[];
  nights: NightRow[];
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
export function emptyReport(): ReportData {
  return {
    meta: EMPTY_META,
    rangeKeys: [],
    episodes: [],
    nights: [],
    naps: [],
    actogram: [],
    sleep: summariseSleep([]),
    fragmentation: summariseFragmentation([], []),
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

export function buildReport(events: readonly AppEvent[], generatedIso: string): ReportData {
  if (events.length === 0) return { ...emptyReport(), meta: { ...EMPTY_META, generatedIso } };

  const eventDayKeys = events.map((e) => wallDateKey(e.occurredAt));
  const range = recordRange(eventDayKeys);
  if (!range) return { ...emptyReport(), meta: { ...EMPTY_META, generatedIso } };

  const coveredKeys = new Set(eventDayKeys);
  const rangeKeys = range.keys;

  const episodes = buildEpisodes(events);
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

  const fragmentsByDay = new Map<string, number>();
  for (const e of episodes) {
    if (e.kind === 'fragment') {
      fragmentsByDay.set(e.dayKey, (fragmentsByDay.get(e.dayKey) ?? 0) + 1);
    }
  }

  const nights: NightRow[] = episodes
    .filter((e) => e.kind === 'main')
    .map((e) => ({
      dayKey: e.dayKey,
      onsetMinutes: e.startMinutes,
      wakeMinutes: e.endMinutes,
      durationMinutes: e.durationMinutes,
      confidence: e.confidence,
      fragments: fragmentsByDay.get(e.dayKey) ?? 0,
    }));

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
    rangeKeys,
    episodes,
    nights,
    naps,
    actogram: buildActogram(episodes, rangeKeys, coveredKeys),
    sleep: summariseSleep(episodes),
    fragmentation: summariseFragmentation(episodes, naps),
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
