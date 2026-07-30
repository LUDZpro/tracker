import { paceAt } from '@/lib/goals';
import styles from './charts.module.css';

interface Props {
  value: number;
  goal: number;
  /** Local hour, fractional (14.5 = 14:30). Omit for goals that do not
   *  accumulate through the day — they get a plain bar with no marker. */
  hourOfDay?: number;
}

export interface PaceState {
  expected: number;
  diff: number;
  behind: boolean;
}

export function paceState(value: number, goal: number, hourOfDay: number): PaceState {
  const expected = paceAt(hourOfDay, goal);
  return { expected, diff: Math.abs(value - expected), behind: value < expected };
}

/**
 * Progress toward an accumulating daily goal, with a marker showing where a
 * steady day would have you by this hour. Without it, "112 of 160 g" reads
 * the same at 09:00 as at 21:00.
 */
export default function PaceBar({ value, goal, hourOfDay }: Props) {
  const fillPct = Math.min(100, Math.max(0, (value / goal) * 100));
  const showMarker = hourOfDay !== undefined && fillPct < 100;
  const expected = hourOfDay !== undefined ? paceAt(hourOfDay, goal) : 0;
  const markPct = Math.min(100, Math.max(0, (expected / goal) * 100));

  const pace =
    hourOfDay === undefined || fillPct >= 100
      ? undefined
      : value >= expected
        ? 'ahead'
        : 'behind';

  return (
    <div className={styles.paceBar} aria-hidden>
      <span className={styles.paceFill} data-pace={pace} style={{ width: `${fillPct}%` }} />
      {showMarker && <span className={styles.paceMark} style={{ left: `${markPct}%` }} />}
    </div>
  );
}
