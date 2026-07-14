'use client';

import { useEffect, useState } from 'react';
import { EventIcon, Icon, toneFor } from '@/components/desktop/presentation';
import { daySleepSpans } from '@/lib/sleep';
import { toLocalISO, wallDateKey, wallHHMM, wallMinutes } from '@/lib/time';
import type { AppEvent, TodayResponse } from '@/lib/types';
import styles from './home.module.css';

const DAY_MIN = 24 * 60;

function pct(minutes: number): string {
  return `${Math.min(100, Math.max(0, (minutes / DAY_MIN) * 100))}%`;
}

function toneClass(ev: AppEvent): string {
  switch (toneFor(ev.type)) {
    case 'sleep':
      return styles.toneSleep;
    case 'intake':
      return styles.toneIntake;
    case 'meal':
      return styles.toneMeal;
    case 'gym':
      return styles.toneGym;
    case 'state':
      return styles.toneState;
  }
}

interface Props {
  today: TodayResponse;
  events: AppEvent[];
}

export default function MobileTopbar({ today, events }: Props) {
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 20_000);
    return () => clearInterval(id);
  }, []);

  const axisKey = today.axis_date;
  const isCurrentDay = axisKey === wallDateKey(today.now);
  const axisEvents = events.filter((e) => wallDateKey(e.occurredAt) === axisKey);
  // Every sleep of the day, not just the latest pair — two sleeps both render.
  const bands = daySleepSpans(events, axisKey, isCurrentDay ? wallMinutes(today.now) : DAY_MIN);
  const nowIso = toLocalISO(clock);

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarRow}>
        <span className={styles.wordmark}>
          <span className={styles.mark} aria-hidden>
            <Icon name="clock" size={16} />
          </span>
          <span>
            tracker<span className={styles.dot}>.</span>
          </span>
        </span>
        <span className={styles.clockBlock}>
          <time className={styles.hclock}>{wallHHMM(nowIso)}</time>
          <span className={styles.hdate}>
            {clock.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long' })}
          </span>
        </span>
      </div>

      <div className={styles.timeline} aria-label={`${axisKey}, midnight to midnight`}>
        <div className={styles.timelineBase} />
        {bands.map((band) => (
          <div
            key={`${band.from}-${band.to}`}
            className={styles.sleepSpan}
            style={
              {
                '--x': pct(band.from),
                '--w': pct(Math.max(0, band.to - band.from)),
              } as React.CSSProperties
            }
          />
        ))}
        {axisEvents.map((ev) => (
          <button
            key={`${ev.id}-${ev.occurredAt}`}
            className={`${styles.timelineEvent} ${toneClass(ev)}`}
            style={{ '--x': pct(wallMinutes(ev.occurredAt)) } as React.CSSProperties}
            aria-label={`${ev.type} at ${wallHHMM(ev.occurredAt)}`}
            type="button"
          >
            <EventIcon ev={ev} size={9} />
          </button>
        ))}
        {isCurrentDay && (
          <div
            className={styles.nowMark}
            style={{ '--x': pct(wallMinutes(nowIso)) } as React.CSSProperties}
            aria-hidden
          />
        )}
      </div>
      <div className={styles.axis} aria-hidden>
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </header>
  );
}
