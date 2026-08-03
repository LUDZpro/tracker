/**
 * Circular statistics for clock times.
 *
 * A linear mean of sleep onsets is wrong in exactly the way that matters
 * here: 23:40 and 00:20 average to 12:00 — the middle of the next day —
 * instead of to midnight. Every onset and wake average in the report goes
 * through the unit circle instead.
 */

const DAY_MINUTES = 1440;
const TAU = Math.PI * 2;

export interface ClockStat {
  /** Circular mean, minutes since midnight (0–1439). */
  meanMinutes: number;
  /**
   * Circular SD in minutes (Mardia). Unbounded in principle, clamped at
   * half a day — past that the times are effectively uniform and the number
   * stops carrying meaning.
   */
  sdMinutes: number;
  /**
   * Mean resultant length, 0–1. 1 = the same clock time every day, 0 = no
   * preferred time at all. Reported because an SD near 6h is easier to
   * misread than "these onsets have almost no centre".
   */
  concentration: number;
  n: number;
}

function toAngle(minutes: number): number {
  const wrapped = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return (TAU * wrapped) / DAY_MINUTES;
}

/** Circular mean/SD of clock times. Null for an empty sample. */
export function circularClockStat(minutes: readonly number[]): ClockStat | null {
  if (minutes.length === 0) return null;

  let sumCos = 0;
  let sumSin = 0;
  for (const m of minutes) {
    const angle = toAngle(m);
    sumCos += Math.cos(angle);
    sumSin += Math.sin(angle);
  }

  const n = minutes.length;
  const c = sumCos / n;
  const s = sumSin / n;
  const r = Math.min(1, Math.sqrt(c * c + s * s));

  const mean = ((Math.atan2(s, c) / TAU) * DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES;
  const sd =
    r <= 0
      ? DAY_MINUTES / 2
      : Math.min(Math.sqrt(-2 * Math.log(r)) * (DAY_MINUTES / TAU), DAY_MINUTES / 2);

  return { meanMinutes: mean, sdMinutes: sd, concentration: r, n };
}

/** Plain mean of a numeric sample. Null when empty. */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (n−1). Null below two values. */
export function stdDev(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values) as number;
  const variance =
    values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Median of a numeric sample. Null when empty. Does not mutate the input. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Clock minutes rendered on a night-centred axis, so a chart can place 22:00
 * below 02:00 rather than at the opposite end. Times before `cutHour` are
 * pushed past the end of the day.
 */
export function nightAxisMinutes(minutes: number, cutHour = 12): number {
  return minutes < cutHour * 60 ? minutes + DAY_MINUTES : minutes;
}

/** "02:06" from minutes since midnight; wraps values outside one day. */
export function formatClock(minutes: number): string {
  const wrapped = Math.round(((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "7h 12m" / "48m" from a minute count. */
export function formatSpan(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** "7.2 h" — the decimal form the summary table uses for durations. */
export function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)} h`;
}

export { DAY_MINUTES };
