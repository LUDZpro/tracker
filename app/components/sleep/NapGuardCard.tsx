'use client';

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
  const span = minutesBetween(pair.start.occurredAt, pair.end.occurredAt);
  const h = Math.floor(span / 60);
  const m = span % 60;

  const dismiss = () => {
    dismissPair(pair.end.id);
    onResolved();
  };

  return (
    <section className={`card ${styles.promptCard}`} aria-label="Short sleep logged">
      <p className={styles.promptText}>
        Slept <time>{wallHHMM(pair.start.occurredAt)}</time>–
        <time>{wallHHMM(pair.end.occurredAt)}</time> ({h > 0 ? `${h}h ` : ''}
        {m}min). It stays as sleep and wake time.
      </p>
      <div className={styles.optionCol}>
        <button className={styles.optionBtn} onClick={dismiss}>
          Got it
        </button>
      </div>
    </section>
  );
}
