'use client';

import { useState } from 'react';
import WheelTimePicker from '@/components/ui/WheelTimePicker';
import { backfillSleep, patchEvent } from '@/lib/client/api';
import { toLocalISO, wallHHMM } from '@/lib/time';
import type { AppEvent, EventType, Precision } from '@/lib/types';
import styles from './sleep.module.css';

export interface DuplicateAttempt {
  type: EventType; // wake_up or sleep_start
  occurredAt: string;
  precision: Precision;
  existing: AppEvent; // the marker already holding this role
}

interface Props {
  attempt: DuplicateAttempt;
  onResolved: () => void;
  onCancel: () => void;
}

/**
 * Shown when a marker tap repeats the current state (awake→awake or
 * asleep→asleep) — never a silent error. Options: replace the previous
 * marker's time, record the missed sleep in between, or cancel.
 */
export default function DuplicateCard({ attempt, onResolved, onCancel }: Props) {
  const isWake = attempt.type === 'wake_up';
  const [dialIso, setDialIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Starting guess for the missed bedtime: ~90min before the new wake,
  // clamped between the previous wake and 30min before the new one.
  const initialBedtime = (): string => {
    const attempted = Date.parse(attempt.occurredAt);
    const previousWake = Date.parse(attempt.existing.occurredAt);
    const guess = Math.max(previousWake + 30 * 60_000, attempted - 90 * 60_000);
    return toLocalISO(new Date(Math.min(guess, attempted - 30 * 60_000)));
  };

  const run = async (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) onResolved();
    else setError(res.message ?? 'Could not save');
  };

  const replaceTime = () =>
    run(async () => {
      const r = await patchEvent(attempt.existing.id, {
        occurred_at: attempt.occurredAt,
        precision: attempt.precision,
      });
      return r.ok ? { ok: true } : { ok: false, message: r.message };
    });

  const addMissedSleep = (bedtimeIso: string) =>
    run(async () => {
      const r = await backfillSleep({
        sleep_start: bedtimeIso,
        wake_up: attempt.occurredAt,
        precision: '~hour',
      });
      return r.ok ? { ok: true } : { ok: false, message: r.message };
    });

  return (
    <section className={`card ${styles.promptCard}`} aria-label="Already logged">
      <p className={styles.promptText}>
        {isWake
          ? `Already awake — last wake was at ${wallHHMM(attempt.existing.occurredAt)}.`
          : `Already asleep — bedtime was logged at ${wallHHMM(attempt.existing.occurredAt)}.`}
      </p>
      <div className={styles.optionCol}>
        <button className={styles.optionBtn} disabled={busy} onClick={replaceTime}>
          Replace time with {wallHHMM(attempt.occurredAt)}
        </button>
        {isWake && (
          <button
            className={styles.optionBtn}
            aria-pressed={dialIso !== null}
            onClick={() => setDialIso(dialIso ? null : initialBedtime())}
          >
            I slept in between — add it
          </button>
        )}
        <button className={styles.skipBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {dialIso && (
        <>
          <p className={styles.promptText}>When did you fall asleep?</p>
          <WheelTimePicker
            valueIso={dialIso}
            onChange={setDialIso}
            nowIso={toLocalISO(new Date())}
            allowPrevDay
          />
          <button
            className={styles.confirmBtn}
            disabled={busy}
            onClick={() => addMissedSleep(dialIso)}
          >
            Log missed sleep
          </button>
        </>
      )}
      {error && (
        <p className="error-inline">
          {error}
          <button onClick={() => setError(null)}>dismiss</button>
        </p>
      )}
    </section>
  );
}
