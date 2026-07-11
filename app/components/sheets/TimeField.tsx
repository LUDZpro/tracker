'use client';

import WheelTimePicker from '@/components/ui/WheelTimePicker';
import { toLocalISO, wallHHMM } from '@/lib/time';
import styles from './sheets.module.css';

interface Props {
  /** null = "log at now" (resolved when the log button is pressed). */
  at: string | null;
  onChange: (at: string | null) => void;
  accent?: string;
}

/** Collapsed "now" row that expands into the wheel picker on demand. */
export default function TimeField({ at, onChange, accent }: Props) {
  if (at === null) {
    return (
      <button
        type="button"
        className={styles.timeField}
        onClick={() => onChange(toLocalISO(new Date()))}
      >
        at <span className="num">now · {wallHHMM(toLocalISO(new Date()))}</span>
        <small> — change</small>
      </button>
    );
  }
  return (
    <div className={styles.timeFieldOpen}>
      <WheelTimePicker
        valueIso={at}
        onChange={onChange}
        nowIso={toLocalISO(new Date())}
        accent={accent}
      />
      <button type="button" className={styles.timeFieldReset} onClick={() => onChange(null)}>
        back to now
      </button>
    </div>
  );
}
