'use client';

import { useState } from 'react';
import Sheet from './Sheet';
import TimeField from './TimeField';
import { toLocalISO } from '@/lib/time';
import type { EventPayload } from '@/lib/types';
import styles from './sheets.module.css';

interface Props {
  kind: 'mood' | 'energy';
  onLog: (payload: EventPayload, label: string) => void;
  onClose: () => void;
  /** Long-press entry: open with the time picker already expanded. */
  pickTime?: boolean;
}

export default function ScaleSheet({ kind, onLog, onClose, pickTime }: Props) {
  const [value, setValue] = useState<number | null>(null);
  const [at, setAt] = useState<string | null>(pickTime ? toLocalISO(new Date()) : null);

  const logIt = () => {
    if (value === null) return;
    onLog(
      {
        type: kind,
        occurred_at: at ?? toLocalISO(new Date()),
        precision: 'exact',
        intensity: value,
        scope: 'momentary',
      },
      `${kind} ${value}/5`,
    );
    onClose();
  };

  return (
    <Sheet title={kind === 'mood' ? 'Mood' : 'Energy'} onClose={onClose}>
      <div className={styles.scaleRow} role="group" aria-label={`${kind} 1 to 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={styles.scaleBtn}
            aria-pressed={value === n}
            onClick={() => setValue(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <TimeField at={at} onChange={setAt} accent="var(--state)" />
      <button className={styles.logBtn} onClick={logIt} disabled={value === null}>
        Log it
      </button>
    </Sheet>
  );
}
