'use client';

import { COLOR_BY_CATEGORY } from './eventPresentation';
import { wallDateKey, wallMinutes } from '@/lib/time';
import type { AppEvent, TodayResponse } from '@/lib/types';
import styles from './home.module.css';

const W = 1000;
const H = 96;
const TRACK_Y = 34;
const TRACK_H = 28;
const DAY_MIN = 24 * 60;

function x(minutes: number): number {
  return (minutes / DAY_MIN) * W;
}

/** Clip the window's sleep pair to the axis date; null when outside it. */
function sleepBandRange(
  lastSleep: TodayResponse['last_sleep'],
  axisKey: string,
): { from: number; to: number } | null {
  const { start, end } = lastSleep;
  if (!start && !end) return null;
  const startsToday = start && wallDateKey(start.occurredAt) === axisKey;
  const endsToday = end && wallDateKey(end.occurredAt) === axisKey;
  if (!startsToday && !endsToday) return null;
  const from = startsToday ? wallMinutes(start.occurredAt) : 0;
  const to = endsToday ? wallMinutes(end.occurredAt) : DAY_MIN;
  return { from, to };
}

interface Props {
  today: TodayResponse;
  /** Display dataset (pending deletes already filtered out). */
  events: AppEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function TodayStrip({ today, events, selectedId, onSelect }: Props) {
  const axisKey = today.axis_date;
  const isCurrentDay = axisKey === wallDateKey(today.now);
  const nowMin = wallMinutes(today.now);
  const axisEvents = events.filter((e) => wallDateKey(e.occurredAt) === axisKey);
  const band = sleepBandRange(today.last_sleep, axisKey);
  const empty = axisEvents.length === 0 && !band;

  return (
    <section className={styles.strip} aria-label={`${axisKey}, midnight to midnight`}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.stripSvg} role="img">
        <rect x="0" y={TRACK_Y} width={W} height={TRACK_H} rx="6" className={styles.track} />
        {band && (
          <rect
            x={x(band.from)}
            y={TRACK_Y}
            width={Math.max(x(band.to) - x(band.from), 4)}
            height={TRACK_H}
            rx="6"
            fill="var(--sleep-dim)"
            stroke="var(--sleep)"
            strokeOpacity="0.5"
          />
        )}
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
          <g key={h}>
            <line
              x1={x(h * 60)}
              y1={TRACK_Y - 6}
              x2={x(h * 60)}
              y2={TRACK_Y + TRACK_H + 6}
              className={styles.gridline}
            />
            <text x={x(h * 60)} y={H - 8} className={styles.axisLabel} textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}>
              {String(h).padStart(2, '0')}
            </text>
          </g>
        ))}
        {axisEvents.map((e) => {
          const selected = e.id === selectedId;
          return (
            <rect
              key={e.id + e.occurredAt}
              x={Math.min(x(wallMinutes(e.occurredAt)), W - 5)}
              y={selected ? TRACK_Y - 8 : TRACK_Y - 4}
              width={selected ? 7 : 5}
              height={selected ? TRACK_H + 16 : TRACK_H + 8}
              rx="2.5"
              fill={COLOR_BY_CATEGORY[e.category]}
              stroke={selected ? 'var(--ink)' : 'none'}
              strokeWidth={selected ? 1.5 : 0}
              className={styles.tick}
              onClick={() => onSelect(e.id)}
            >
              <title>{`${e.category}:${e.type}`}</title>
            </rect>
          );
        })}
        {isCurrentDay && (
          <line
            x1={x(nowMin)}
            y1={TRACK_Y - 10}
            x2={x(nowMin)}
            y2={TRACK_Y + TRACK_H + 10}
            className={styles.nowLine}
          />
        )}
      </svg>
      {empty && today.offset === 0 && (
        <p className={styles.emptyHint}>
          Nothing logged yet today — first tap starts the day.
        </p>
      )}
    </section>
  );
}
