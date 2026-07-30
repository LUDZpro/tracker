import type { GoalState } from '@/lib/goals';

/** One composition row inside a tooltip: "Asleep — 23:50". */
export interface TipRow {
  k: string;
  v: string;
}

/**
 * What a column says when you hover, focus or tap it. The point of carrying
 * `rows` is that a week review never has to leave the chart for the ledger.
 */
export interface TipContent {
  /** "Sun 24 Jul" */
  day: string;
  /** "5h 35m" — already formatted; charts don't know units. */
  value: string;
  /** "1h 25m below your range" — factual, never a judgment of the person. */
  verdict: string;
  rows?: TipRow[];
}

export interface ChartPoint {
  /** YYYY-MM-DD */
  key: string;
  /** Narrow axis label, e.g. "T". */
  label: string;
  /** null means the day was never logged — not a zero. */
  value: number | null;
  state: GoalState;
  isToday: boolean;
  tip: TipContent;
}

/** The whole sentence, for the column button's accessible name. */
export function tipSentence(tip: TipContent): string {
  const base = `${tip.day}, ${tip.value}`;
  return tip.verdict ? `${base}, ${tip.verdict}` : base;
}
