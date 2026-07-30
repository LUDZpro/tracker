'use client';

import { heightPct, rulePct } from '@/lib/goals';
import ChartTip from './ChartTip';
import { useTipToggle } from './useTipToggle';
import { tipSentence, type ChartPoint } from './types';
import styles from './charts.module.css';

interface Props {
  points: ChartPoint[];
  scaleMax: number;
  /** Single reference line — floor and ceiling goals. */
  rule?: { value: number; label?: string };
  /** Two-sided zone — band goals. Drawn instead of a rule, never both. */
  band?: { min: number; max: number; label?: string };
  /** Values above this print their real number above a capped bar. */
  capAbove?: number;
  /** Formats the overshoot tag; defaults to the raw number. */
  formatCap?: (value: number) => string;
}

function align(index: number, total: number): 'start' | 'center' | 'end' {
  if (index === 0) return 'start';
  if (index === total - 1) return 'end';
  return 'center';
}

/**
 * The workhorse bar chart. Every bar is a comparison, not just a quantity:
 * the goal is drawn, a gap is a gap, and an outlier is labelled rather than
 * clipped. Spec: design-system/charts-lab.html §C3–C6.
 */
export default function Spark({ points, scaleMax, rule, band, capAbove, formatCap }: Props) {
  const { toggle, isOpen } = useTipToggle();

  return (
    <div className={styles.plot}>
      {band && (
        <div
          className={styles.band}
          style={{
            bottom: `${rulePct(band.min, scaleMax)}%`,
            height: `${rulePct(band.max, scaleMax) - rulePct(band.min, scaleMax)}%`,
          }}
          aria-hidden
        >
          {band.label && <span className={styles.bandKey}>{band.label}</span>}
        </div>
      )}

      {rule && !band && (
        <div
          className={styles.rule}
          style={{ bottom: `${rulePct(rule.value, scaleMax)}%` }}
          aria-hidden
        >
          {rule.label && <span className={styles.ruleKey}>{rule.label}</span>}
        </div>
      )}

      {points.map((p, i) => {
        const capped = capAbove !== undefined && p.value !== null && p.value > capAbove;
        const open = isOpen(p.key);

        return (
          <div
            key={p.key}
            data-chart-col
            className={`${styles.col} ${open ? styles.tipOpen : ''}`}
          >
            {p.value === null ? (
              <>
                <span className={styles.missing} aria-hidden />
                <span className={styles.missingRing} aria-hidden />
              </>
            ) : (
              <span
                className={`${styles.bar} ${capped ? styles.over : ''} ${
                  p.isToday ? styles.today : ''
                }`}
                data-state={p.state}
                style={{ height: `${heightPct(p.value, scaleMax)}%` }}
                aria-hidden
              />
            )}

            {capped && p.value !== null && (
              <span className={styles.overTag} aria-hidden>
                {formatCap ? formatCap(p.value) : p.value}
              </span>
            )}

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
