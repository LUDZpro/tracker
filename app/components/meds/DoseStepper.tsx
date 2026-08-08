'use client';

import { formatDose, type Dose } from '@/lib/substances/format';
import styles from './meds.module.css';

interface Props {
  dose: Dose;
  onChange: (dose: Dose) => void;
  unit: string;
}

/**
 * Step size follows the magnitude of the dose, so 1.9 mg melatonin nudges by
 * 0.1 while 2000 IU of D3 nudges by 100 — one control for doses three orders
 * of magnitude apart.
 */
function stepFor(amount: number): number {
  if (amount < 5) return 0.1;
  if (amount < 50) return 5;
  if (amount < 500) return 25;
  return 100;
}

const MAX_DOSE = 100_000;

export default function DoseStepper({ dose, onChange, unit }: Props) {
  const nudge = (direction: 1 | -1) => {
    const step = stepFor(dose.amount);
    // Re-round to the step grid: floats otherwise drift to 1.9000000000000001.
    const next = Number((dose.amount + direction * step).toFixed(3));
    onChange({ ...dose, amount: Math.min(MAX_DOSE, Math.max(step, next)) });
  };

  return (
    <div className={styles.doseRow}>
      <button
        type="button"
        className={styles.doseBtn}
        onClick={() => nudge(-1)}
        aria-label="Smaller dose"
      >
        −
      </button>
      <span className={styles.doseValue}>{formatDose({ ...dose, unit })}</span>
      <button
        type="button"
        className={styles.doseBtn}
        onClick={() => nudge(1)}
        aria-label="Larger dose"
      >
        +
      </button>
    </div>
  );
}
