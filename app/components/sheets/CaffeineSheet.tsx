'use client';

import { useState } from 'react';
import Sheet from './Sheet';
import TimeField from './TimeField';
import { toLocalISO } from '@/lib/time';
import { CAFFEINE_KINDS, type CaffeineKind, type EventPayload } from '@/lib/types';
import styles from './sheets.module.css';

interface Props {
  onLog: (payload: EventPayload, label: string) => void;
  onClose: () => void;
  /** Long-press entry: open with the time picker already expanded. */
  pickTime?: boolean;
  /** Desktop capture buttons are per-kind (Coffee/Tea/Energy drink). */
  initialKind?: CaffeineKind;
}

export default function CaffeineSheet({ onLog, onClose, pickTime, initialKind }: Props) {
  const [kind, setKind] = useState<CaffeineKind>(initialKind ?? 'coffee');
  const [at, setAt] = useState<string | null>(pickTime ? toLocalISO(new Date()) : null);

  const logIt = () => {
    onLog(
      {
        type: 'caffeine',
        occurred_at: at ?? toLocalISO(new Date()),
        precision: 'exact',
        kind,
      },
      `caffeine ${kind}`,
    );
    onClose();
  };

  return (
    <Sheet title="Caffeine" onClose={onClose}>
      <div className={styles.chipRow}>
        {CAFFEINE_KINDS.map((k) => (
          <button
            key={k}
            className={`chip ${styles.bigChip}`}
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {k}
          </button>
        ))}
      </div>
      <TimeField at={at} onChange={setAt} accent="var(--intake)" />
      <button className={styles.logBtn} onClick={logIt}>
        Log it
      </button>
    </Sheet>
  );
}
