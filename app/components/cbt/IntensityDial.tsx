'use client';

import { sudsColor } from './presentation';
import styles from './cbt.module.css';

const ARC_R = 78;
const ARC_LEN = Math.PI * ARC_R; // semicircle circumference

interface Props {
  value: number; // 0–100
  onChange: (v: number) => void;
  label: string; // e.g. "How strong is it right now?"
  hint?: string;
}

/** SUDS gauge: a semicircle arc that fills and shifts color with the value,
 *  driven by a native range input so touch/keyboard stay reliable. */
export default function IntensityDial({ value, onChange, label, hint }: Props) {
  const color = sudsColor(value);
  const filled = (value / 100) * ARC_LEN;

  return (
    <div className={styles.dial}>
      <svg viewBox="0 0 200 112" className={styles.dialArc} aria-hidden>
        <path
          d="M22 100 A 78 78 0 0 1 178 100"
          fill="none"
          stroke="var(--line)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M22 100 A 78 78 0 0 1 178 100"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${ARC_LEN}`}
          className={styles.dialFill}
        />
        <text x="100" y="86" textAnchor="middle" className={styles.dialNumber} fill={color}>
          {value}
        </text>
        <text x="100" y="104" textAnchor="middle" className={styles.dialUnit} fill="var(--t3)">
          / 100
        </text>
      </svg>
      <div className={styles.dialEnds} aria-hidden>
        <span>calm</span>
        <span>unbearable</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.dialRange}
        style={{ '--suds': color } as React.CSSProperties}
        aria-label={label}
      />
      {hint && <p className={styles.stepHint}>{hint}</p>}
    </div>
  );
}
