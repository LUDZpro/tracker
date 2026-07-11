'use client';

import { useState } from 'react';
import Sheet from './Sheet';
import TimeField from './TimeField';
import { toLocalISO } from '@/lib/time';
import type { EventPayload } from '@/lib/types';
import styles from './sheets.module.css';

const PRESETS = [20, 45, 90] as const;
const STEP = 5;
const MAX = 600;

interface Props {
  onLog: (payload: EventPayload, label: string) => void;
  onClose: () => void;
  /** Long-press entry: open with the time picker already expanded. */
  pickTime?: boolean;
}

export default function NapSheet({ onLog, onClose, pickTime }: Props) {
  const [minutes, setMinutes] = useState<number>(45);
  const [custom, setCustom] = useState(false);
  const [at, setAt] = useState<string | null>(pickTime ? toLocalISO(new Date()) : null);

  const logIt = () => {
    onLog(
      {
        type: 'nap',
        occurred_at: at ?? toLocalISO(new Date()),
        precision: 'exact',
        duration: minutes,
      },
      `nap ${minutes}min`,
    );
    onClose();
  };

  return (
    <Sheet title="Nap" onClose={onClose}>
      <div className={styles.chipRow}>
        {PRESETS.map((m) => (
          <button
            key={m}
            className={`chip ${styles.bigChip}`}
            aria-pressed={!custom && minutes === m}
            onClick={() => {
              setCustom(false);
              setMinutes(m);
            }}
          >
            {m}min
          </button>
        ))}
        <button
          className={`chip ${styles.bigChip}`}
          aria-pressed={custom}
          onClick={() => setCustom(true)}
        >
          custom
        </button>
      </div>
      {custom && (
        <div className={styles.stepper}>
          <button onClick={() => setMinutes((m) => Math.max(STEP, m - STEP))} aria-label="Less">
            −
          </button>
          <span className={styles.stepperValue}>{minutes}min</span>
          <button onClick={() => setMinutes((m) => Math.min(MAX, m + STEP))} aria-label="More">
            +
          </button>
        </div>
      )}
      <TimeField at={at} onChange={setAt} accent="var(--sleep)" />
      <button className={styles.logBtn} onClick={logIt}>
        Log it
      </button>
    </Sheet>
  );
}
