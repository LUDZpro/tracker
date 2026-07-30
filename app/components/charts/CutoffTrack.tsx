'use client';

import { CAFFEINE_COUNT_GOAL, CAFFEINE_TIME_GOAL, evaluate } from '@/lib/goals';
import styles from './charts.module.css';

export interface CutoffDay {
  key: string;
  /** Short weekday, e.g. "Mon". */
  label: string;
  /** Wall minutes of each entry, ascending. */
  minutes: number[];
  /** HH:MM of the last entry; null when none. */
  last: string | null;
}

interface Props {
  days: CutoffDay[];
}

const { axisStartMin, axisEndMin, cutoffMin } = CAFFEINE_TIME_GOAL;
const SPAN = axisEndMin - axisStartMin;

function pct(minutes: number): number {
  return Math.max(0, Math.min(100, ((minutes - axisStartMin) / SPAN) * 100));
}

function hh(minutes: number): string {
  return String(Math.floor(minutes / 60)).padStart(2, '0');
}

/**
 * Caffeine on a clock axis. The dot row this replaces packed intakes in log
 * order and encoded lateness as a colour swap, so the dots carried no time at
 * all. Here lateness is a *position past a line* — readable before any hue is
 * decoded. The count ceiling rides alongside: too many is flagged as well as
 * too late. Spec: charts-lab.html §C8.
 */
export default function CutoffTrack({ days }: Props) {
  const ticks = [axisStartMin, axisStartMin + 4 * 60, axisStartMin + 8 * 60, axisEndMin];

  return (
    <div>
      {days.map((day) => {
        const lastMin = day.minutes[day.minutes.length - 1];
        const timeState = lastMin === undefined ? 'none' : evaluate(CAFFEINE_TIME_GOAL, lastMin);
        const countState = evaluate(CAFFEINE_COUNT_GOAL, day.minutes.length);

        return (
          <div key={day.key} className={styles.ctRow}>
            <span className={styles.ctDay}>{day.label}</span>
            <span className={styles.ctTrack}>
              <span className={styles.ctAfter} style={{ left: `${pct(cutoffMin)}%` }} />
              <span className={styles.ctCut} style={{ left: `${pct(cutoffMin)}%` }} />
              {day.minutes.map((m, i) => {
                const state = evaluate(CAFFEINE_TIME_GOAL, m);
                return (
                  <span
                    key={`${day.key}-${i}`}
                    className={`${styles.ctDot} ${
                      state === 'bad'
                        ? `${styles.ctDotLate} ${styles.ctDotBad}`
                        : state === 'over'
                          ? styles.ctDotLate
                          : ''
                    }`}
                    style={{ left: `${pct(m)}%` }}
                  />
                );
              })}
            </span>
            <span
              className={`${styles.ctCount} ${
                countState !== 'goal' && day.minutes.length > 0 ? styles.ctCountOver : ''
              }`}
            >
              {day.minutes.length > 0 ? `×${day.minutes.length}` : ''}
            </span>
            <span
              className={`${styles.ctLast} ${
                timeState === 'bad'
                  ? styles.ctLastBad
                  : timeState === 'over'
                    ? styles.ctLastLate
                    : ''
              }`}
            >
              {day.last ?? '—'}
            </span>
          </div>
        );
      })}

      <div className={styles.ctAxis} aria-hidden>
        {ticks.map((t) => (
          <span key={t} style={{ left: `${pct(t)}%` }}>
            {hh(t)}
          </span>
        ))}
        <span className={styles.ctAxisCut} style={{ left: `${pct(cutoffMin) + 0.5}%` }}>
          {hh(cutoffMin)}:00 cutoff
        </span>
      </div>
    </div>
  );
}
