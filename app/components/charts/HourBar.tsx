'use client';

import { rulePct } from '@/lib/goals';
import ChartTip from './ChartTip';
import { useTipToggle } from './useTipToggle';
import { tipSentence, type ChartPoint } from './types';
import styles from './charts.module.css';

interface Props {
  /** Values are in minutes; one block is drawn per hour. */
  points: ChartPoint[];
  /** Hours on the scale, e.g. 10 for a 0–10h sleep chart. */
  scaleHours: number;
  /** Hours at or above which the night met its goal. */
  goalHours: number;
  /** Hours above which it is too long — band goals only. */
  overHours?: number;
  /** Ruler ticks down the left edge. */
  ticks?: number[];
}

function align(index: number, total: number): 'start' | 'center' | 'end' {
  if (index === 0) return 'start';
  if (index === total - 1) return 'end';
  return 'center';
}

/**
 * Sleep as countable one-hour blocks rather than an estimated height. Same
 * argument as the mood grid: discrete units stay countable in a way a bar
 * height never is, and the metric where the exact number is the point is the
 * one that should be countable. Spec: charts-lab.html §C10.
 */
export default function HourBar({
  points,
  scaleHours,
  goalHours,
  overHours,
  ticks = [0, 2, 4, 6, 8, 10],
}: Props) {
  const { toggle, isOpen } = useTipToggle();
  const blocks = Array.from({ length: scaleHours }, (_, i) => i);

  return (
    <div className={styles.hours}>
      <div className={styles.hourScale} aria-hidden>
        {ticks
          .filter((t) => t <= scaleHours)
          .map((t) => (
            <span key={t} style={{ bottom: `${(t / scaleHours) * 100}%` }}>
              {t}
            </span>
          ))}
      </div>

      <div
        className={styles.rule}
        style={{ bottom: `${rulePct(goalHours, scaleHours)}%` }}
        aria-hidden
      />

      {points.map((p, i) => {
        const hours = p.value === null ? 0 : p.value / 60;
        const open = isOpen(p.key);

        return (
          <div
            key={p.key}
            data-chart-col
            className={`${styles.hourCol} ${open ? styles.tipOpen : ''}`}
            data-state={p.state}
            data-today={p.isToday ? 'true' : undefined}
          >
            {blocks.map((b) => {
              // Block b covers hours b → b+1. Filled when the night reached
              // into it; the last one is a part-hour and renders faded.
              const filled = hours > b;
              const part = filled && hours < b + 1;
              const fill = !filled
                ? undefined
                : overHours !== undefined && b >= overHours
                  ? 'over'
                  : b >= goalHours
                    ? 'goal'
                    : 'base';

              return (
                <span
                  key={b}
                  className={`${styles.hourBlock} ${part ? styles.hourPart : ''}`}
                  data-fill={fill}
                  aria-hidden
                />
              );
            })}

            <button
              type="button"
              className={styles.hit}
              onClick={() => toggle(p.key)}
              aria-label={tipSentence(p.tip)}
            >
              <ChartTip tip={p.tip} state={p.state} align={align(i, points.length)} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
