'use client';

import { useState } from 'react';
import { convertToNap } from '@/lib/client/api';
import { dismissPair } from '@/lib/client/skips';
import { minutesBetween, wallHHMM } from '@/lib/time';
import type { SleepPair } from '@/lib/types';
import styles from './sleep.module.css';

interface Props {
  pair: SleepPair;
  onResolved: () => void;
}

/** Offered when a completed pair looks like a nap (<3h or fully daytime). */
export default function NapGuardCard({ pair, onResolved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const span = minutesBetween(pair.start.occurredAt, pair.end.occurredAt);
  const h = Math.floor(span / 60);
  const m = span % 60;

  const convert = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    navigator.vibrate?.(50);
    const res = await convertToNap(pair.end.id);
    setBusy(false);
    if (res.ok) onResolved();
    else setError(res.message);
  };

  return (
    <section className={`card ${styles.promptCard}`} aria-label="Was that a nap?">
      <p className={styles.promptText}>
        Slept <time>{wallHHMM(pair.start.occurredAt)}</time>–
        <time>{wallHHMM(pair.end.occurredAt)}</time> ({h > 0 ? `${h}h ` : ''}
        {m}min) — was that a nap?
      </p>
      <div className={styles.optionCol}>
        <button className={styles.optionBtn} disabled={busy} onClick={convert}>
          Convert to nap
        </button>
        <button
          className={styles.skipBtn}
          onClick={() => {
            dismissPair(pair.end.id);
            onResolved();
          }}
        >
          Keep as sleep
        </button>
      </div>
      {error && (
        <p className="error-inline">
          {error}
          <button onClick={convert}>retry</button>
        </p>
      )}
    </section>
  );
}
