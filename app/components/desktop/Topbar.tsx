'use client';

import { useEffect, useState } from 'react';
import { EventIcon, rowText, toneFor } from './presentation';
import { daySleepSpans } from '@/lib/sleep';
import { wallDateKey, wallHHMM, wallMinutes } from '@/lib/time';
import type { AppEvent, TodayResponse } from '@/lib/types';
import styles from './desktop.module.css';

const DAY_MIN = 24 * 60;
const CLOCK_TICK_MS = 20_000;

const TONE_CLASS: Record<string, string> = {
  sleep: styles.cSleep,
  intake: styles.cIntake,
  meal: styles.cMeal,
  gym: styles.cGym,
  state: styles.cState,
};

function pct(minutes: number): string {
  return `${(minutes / DAY_MIN) * 100}%`;
}

interface Props {
  today: TodayResponse | null;
  /** Merged floor + meal/gym events (pending deletes filtered out). */
  events: AppEvent[];
  onOpen: (ev: AppEvent) => void;
}

/** Clock + midnight-to-midnight timeline across the top of the desktop shell. */
export default function Topbar({ today, events, onOpen }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(t);
  }, []);

  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateLine = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const axisKey = today?.axis_date ?? null;
  const axisEvents = axisKey
    ? events.filter((e) => wallDateKey(e.occurredAt) === axisKey)
    : [];
  const isCurrentDay = today !== null && axisKey === wallDateKey(today.now);
  // Every sleep of the day, not just the latest pair — two sleeps both render.
  const spans = axisKey
    ? daySleepSpans(events, axisKey, isCurrentDay && today ? wallMinutes(today.now) : DAY_MIN)
    : [];

  return (
    <header className={styles.topbar}>
      <div className={styles.clockbox}>
        <div className={styles.wordmark}>
          tracker<span>.</span>
        </div>
        <time className={styles.clock}>{hhmm}</time>
        <div className={styles.clockDate}>{dateLine.replace(',', ' ·')}</div>
      </div>
      <div className={styles.tlwrap}>
        <div className={styles.tlhd}>
          <span className={styles.eyebrow}>Today</span>
        </div>
        <div className={styles.tl} aria-label="Today, midnight to midnight">
          <div className={styles.tlBase} />
          {spans.map((span) => (
            <div
              key={`${span.from}-${span.to}`}
              className={styles.sleepspan}
              style={{ left: pct(span.from), width: pct(Math.max(span.to - span.from, 8)) }}
            />
          ))}
          {axisEvents.map((e) => {
            const { main } = rowText(e);
            return (
              <button
                key={e.id + e.occurredAt}
                className={`${styles.evdot} ${TONE_CLASS[toneFor(e.type)]}`}
                style={{ left: pct(wallMinutes(e.occurredAt)) }}
                onClick={() => onOpen(e)}
              >
                <EventIcon ev={e} size={11} />
                <span className={styles.tip}>
                  {wallHHMM(e.occurredAt)} · {main}
                </span>
              </button>
            );
          })}
          {isCurrentDay && (
            <div className={styles.nowline} style={{ left: pct(wallMinutes(today.now)) }} />
          )}
        </div>
        <div className={styles.axis} aria-hidden>
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
            <span key={h}>{String(h).padStart(2, '0')}</span>
          ))}
        </div>
      </div>
    </header>
  );
}
