'use client';

import { toLocalISO, wallHHMM } from '@/lib/time';
import type { AppEvent, EventPayload } from '@/lib/types';
import styles from './home.module.css';

interface Props {
  events: AppEvent[];
  onLog: (payload: EventPayload, label: string) => void;
}

function latestScale(events: readonly AppEvent[], kind: 'mood' | 'energy') {
  const matching = events
    .filter((e) => e.type === kind && e.intensity !== undefined)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  return matching[matching.length - 1] ?? null;
}

function RatingRow({
  kind,
  label,
  events,
  onLog,
}: {
  kind: 'mood' | 'energy';
  label: string;
  events: AppEvent[];
  onLog: Props['onLog'];
}) {
  const latest = latestScale(events, kind);

  return (
    <>
      <div className={styles.rateLabel}>
        <span>{label}</span>
        <span>{latest?.intensity ? `${latest.intensity} · ${wallHHMM(latest.occurredAt)}` : 'not logged'}</span>
      </div>
      <div className={styles.rate} role="group" aria-label={`${label} 1 to 5`}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            className={latest?.intensity === value ? styles.rateOn : ''}
            aria-pressed={latest?.intensity === value}
            onClick={() =>
              onLog(
                {
                  type: kind,
                  occurred_at: toLocalISO(new Date()),
                  precision: 'exact',
                  intensity: value,
                  scope: 'momentary',
                },
                `${kind} ${value}/5`,
              )
            }
          >
            {value}
          </button>
        ))}
      </div>
    </>
  );
}

export default function ScaleQuickLog({ events, onLog }: Props) {
  return (
    <section className={styles.section} aria-label="Mood and energy">
      <RatingRow kind="mood" label="Mood" events={events} onLog={onLog} />
      <RatingRow kind="energy" label="Energy" events={events} onLog={onLog} />
    </section>
  );
}
