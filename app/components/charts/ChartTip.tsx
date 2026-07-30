import type { GoalState } from '@/lib/goals';
import type { TipContent } from './types';
import styles from './charts.module.css';

interface Props {
  tip: TipContent;
  state: GoalState;
  /** Clamps the popover so an edge column never overflows its card. */
  align: 'start' | 'center' | 'end';
}

const ALIGN_CLASS: Record<Props['align'], string> = {
  start: styles.tipStart,
  center: '',
  end: styles.tipEnd,
};

/** Presentational only — the value is also in the column button's aria-label,
 *  so this is never the sole route to the number. */
export default function ChartTip({ tip, state, align }: Props) {
  return (
    <span className={`${styles.tip} ${ALIGN_CLASS[align]}`} aria-hidden>
      <span className={styles.tipDay}>{tip.day}</span>
      <span className={styles.tipValue}>{tip.value}</span>
      {tip.verdict && (
        <span className={styles.tipVerdict} data-state={state}>
          {tip.verdict}
        </span>
      )}
      {tip.rows?.map((row) => (
        <span key={row.k} className={styles.tipRow}>
          <span>{row.k}</span>
          <b>{row.v}</b>
        </span>
      ))}
    </span>
  );
}
