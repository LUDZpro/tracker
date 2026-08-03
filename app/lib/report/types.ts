import type { AppEvent } from '../types';

/**
 * How much the timestamp can be trusted.
 *
 * The event log mixes three provenances and a clinical reader has to be able
 * to tell them apart: an onset logged the moment it happened is evidence,
 * the same onset rebuilt from a diary weeks later is a recollection. The
 * database's `precision` column carries a `synthetic` value that the app's
 * writable `Precision` union deliberately does not — it only ever arrived
 * through the one-time Notion import.
 */
export type Confidence = 'logged' | 'approximate' | 'reconstructed';

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  logged: 'Logged at the time',
  approximate: 'Logged, time approximate',
  reconstructed: 'Reconstructed from notes',
};

/** A completed sleep_start → wake_up span. */
export interface SleepEpisode {
  startIso: string;
  endIso: string;
  /** Noon-anchored day the onset belongs to (a 02:00 onset is the night before). */
  dayKey: string;
  /** Wall minutes since midnight of the onset. */
  startMinutes: number;
  endMinutes: number;
  /** Wall-clock elapsed minutes — see `wallMinutesBetween`. */
  durationMinutes: number;
  /** The longest episode of its noon-anchored day is `main`. */
  kind: 'main' | 'fragment';
  confidence: Confidence;
}

/** An explicitly logged `nap` event (separate from a short sleep fragment). */
export interface NapRecord {
  atIso: string;
  dayKey: string;
  startMinutes: number;
  /** Null when the nap was logged without a duration. */
  durationMinutes: number | null;
  confidence: Confidence;
}

/** A point-in-time intake event placed on a clock axis. */
export interface TimedPoint {
  atIso: string;
  dayKey: string;
  minutes: number;
  label: string;
}

/** A 1–5 self-rating. */
export interface RatingPoint {
  atIso: string;
  dayKey: string;
  minutes: number;
  value: number;
}

/** One calendar day's counts, including days with nothing logged. */
export interface DayCount {
  dayKey: string;
  count: number;
  /** False when the day sits outside any tracking period. */
  covered: boolean;
}

/** A contiguous stretch of days that carry at least one event. */
export interface CoverageBlock {
  fromKey: string;
  toKey: string;
  days: number;
}

export interface ReportInput {
  events: readonly AppEvent[];
  /** Local ISO "now"; bounds the last day of the report. */
  nowIso: string;
}
