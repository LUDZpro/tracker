import { isBreach } from '@/lib/goals';
import type { ChartPoint } from './types';
import styles from './charts.module.css';

interface Props {
  points: ChartPoint[];
  /** Extra left offset when the chart carries an hour ruler. */
  inset?: boolean;
}

/**
 * Day letters, tinted to repeat the column's verdict. That repetition is the
 * non-color-only channel: a breach is legible from the axis alone.
 */
export default function ChartAxis({ points, inset }: Props) {
  return (
    <div className={styles.axis} style={inset ? { marginLeft: 22 } : undefined} aria-hidden>
      {points.map((p) => (
        <span
          key={p.key}
          className={
            p.isToday
              ? styles.axToday
              : p.state === 'none'
                ? styles.axMissing
                : isBreach(p.state)
                  ? styles.axFlag
                  : ''
          }
        >
          {p.label}
        </span>
      ))}
    </div>
  );
}
