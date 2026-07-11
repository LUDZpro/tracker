'use client';

import { useState } from 'react';
import WheelTimePicker from '@/components/ui/WheelTimePicker';
import { backfillSleep } from '@/lib/client/api';
import { skipNight } from '@/lib/client/skips';
import { shiftDateKey, toLocalISO } from '@/lib/time';
import type { Precision } from '@/lib/types';
import styles from './sleep.module.css';

interface Props {
  night: string; // morning date key, e.g. "2026-07-06"
  todayKey: string;
  onDone: () => void;
}

function nightIso(night: string, hour: number, minute: number, prevEvening: boolean): string {
  const key = prevEvening ? shiftDateKey(night, -1) : night;
  const [y, mo, d] = key.split('-').map(Number);
  return toLocalISO(new Date(y, mo - 1, d, hour, minute));
}

const FUZZY = (night: string) =>
  [
    { label: 'before 11pm', iso: nightIso(night, 22, 30, true), precision: '~hour' },
    { label: 'around midnight', iso: nightIso(night, 0, 0, false), precision: '~hour' },
    { label: 'after 2am', iso: nightIso(night, 2, 30, false), precision: '~hour' },
    { label: 'no idea, sometime that night', iso: nightIso(night, 23, 0, true), precision: '~part_of_day' },
  ] as const;

/** "No bedtime logged — when did you fall asleep?" backfill card. */
export default function MissingNightCard({ night, todayKey, onDone }: Props) {
  const [dialIso, setDialIso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (iso: string, precision: Precision) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    navigator.vibrate?.(50);
    const res = await backfillSleep({ sleep_start: iso, precision });
    setBusy(false);
    if (res.ok) onDone();
    else setError(res.message);
  };

  const isLastNight = night === todayKey;
  return (
    <section className={`card ${styles.promptCard}`} aria-label="Missing bedtime">
      <p className={styles.promptText}>
        No bedtime logged{isLastNight ? '' : ` for the night before ${night}`} — when did you
        fall asleep?
      </p>
      <div className={styles.fuzzyRow}>
        {FUZZY(night).map((f) => (
          <button
            key={f.label}
            className="chip"
            disabled={busy}
            onClick={() => submit(f.iso, f.precision as Precision)}
          >
            {f.label}
          </button>
        ))}
        <button
          className="chip"
          aria-pressed={dialIso !== null}
          onClick={() => setDialIso(dialIso ? null : nightIso(night, 23, 30, true))}
        >
          pick a time
        </button>
      </div>
      {dialIso && (
        <>
          <WheelTimePicker
            valueIso={dialIso}
            onChange={setDialIso}
            nowIso={toLocalISO(new Date())}
            allowPrevDay
          />
          <button
            className={styles.confirmBtn}
            disabled={busy}
            onClick={() => submit(dialIso, 'exact')}
          >
            Log bedtime
          </button>
        </>
      )}
      {error && (
        <p className="error-inline">
          {error}
          <button onClick={() => setError(null)}>dismiss</button>
        </p>
      )}
      <button
        className={styles.skipBtn}
        onClick={() => {
          skipNight(night);
          onDone();
        }}
      >
        skip
      </button>
    </section>
  );
}
