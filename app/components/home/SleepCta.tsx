'use client';

import { useState } from 'react';
import TimeSheet from '@/components/sheets/TimeSheet';
import { useLongPress } from '@/hooks/useLongPress';
import { toLocalISO } from '@/lib/time';
import type { EventPayload } from '@/lib/types';
import styles from './home.module.css';

interface Props {
  state: 'awake' | 'asleep';
  onLog: (payload: EventPayload, label: string) => void;
}

/**
 * Contextual sleep CTA. Tap logs "now" (exact); long-press — or the
 * "another time" link — opens the wheel picker (UX-PATCH-03, no offset chips).
 */
export default function SleepCta({ state, onLog }: Props) {
  const [picking, setPicking] = useState(false);
  const type = state === 'asleep' ? 'wake_up' : 'sleep_start';
  const label = state === 'asleep' ? "I'm awake" : 'Going to sleep';
  const { guard, handlers } = useLongPress(() => setPicking(true));

  const log = (at: string) => {
    onLog({ type, occurred_at: at, precision: 'exact' }, label);
  };

  return (
    <section className={styles.ctaBlock} aria-label="Sleep">
      <button
        className={`${styles.ctaMain} ${state === 'asleep' ? styles.ctaWake : styles.ctaSleep} btn-flash`}
        {...handlers}
        onClick={guard(() => log(toLocalISO(new Date())))}
      >
        {label}
      </button>
      <button className={styles.ctaTimeLink} onClick={() => setPicking(true)}>
        {label.toLowerCase()} at another time…
      </button>
      {picking && (
        <TimeSheet
          title={label}
          confirmLabel="Log it"
          initialIso={toLocalISO(new Date())}
          nowIso={toLocalISO(new Date())}
          allowPrevDay
          onConfirm={(iso) => {
            log(iso);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </section>
  );
}
