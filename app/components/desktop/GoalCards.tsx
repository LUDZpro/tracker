'use client';

import { Icon } from './presentation';
import {
  CAFFEINE_COUNT_GOAL,
  CAFFEINE_TIME_GOAL,
  PROTEIN_GOAL,
  SLEEP_GOAL,
  evaluate,
  isBreach,
} from '@/lib/goals';
import { formatDuration } from '@/lib/weekStats';
import { minutesBetween, wallHHMM, wallMinutes, wallParts } from '@/lib/time';
import PaceBar, { paceState } from '../charts/PaceBar';
import type { AppEvent, TodayResponse } from '@/lib/types';
import styles from './desktop.module.css';

type Status = 'done' | 'warn' | 'open';

const STATUS_CLASS: Record<Status, string> = {
  done: styles.stDone,
  warn: styles.stWarn,
  open: styles.stOpen,
};

function StatusDot({ status }: { status: Status }) {
  return (
    <span className={`${styles.st} ${STATUS_CLASS[status]}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {status === 'warn' ? <path d="M12 6v7M12 17h.01" /> : <path d="M20 6 9 17l-5-5" />}
      </svg>
    </span>
  );
}

interface CardProps {
  title: string;
  icon: Parameters<typeof Icon>[0]['name'];
  status: Status;
  n: React.ReactNode;
  small?: boolean;
  bar?: number; // 0–100
  /** Renders a pace-marked bar instead of a plain one. */
  pace?: { value: number; goal: number; hourOfDay: number };
  s: string;
}

function Card({ title, icon, status, n, small, bar, pace, s }: CardProps) {
  return (
    <div className={styles.card}>
      <StatusDot status={status} />
      <div className={styles.cardK}>
        <Icon name={icon} size={12} />
        {title}
      </div>
      <div className={`${styles.cardN} ${small ? styles.cardNsm : ''}`}>{n}</div>
      {pace !== undefined ? (
        <PaceBar value={pace.value} goal={pace.goal} hourOfDay={pace.hourOfDay} />
      ) : (
        bar !== undefined && (
          <div className={styles.bar}>
            <i style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
          </div>
        )
      )}
      <div className={styles.cardS}>{s}</div>
    </div>
  );
}

interface Props {
  today: TodayResponse;
  /** Merged floor + meal/gym events for the current day. */
  todayEvents: AppEvent[];
}

/** Protein / Sleep / Gym / Caffeine at-a-glance cards. */
export default function GoalCards({ today, todayEvents }: Props) {
  const protein = todayEvents
    .filter((e) => e.type === 'meal')
    .reduce((sum, e) => sum + (e.proteinG ?? 0), 0);

  const { start, end } = today.last_sleep;
  const night = start && end ? minutesBetween(start.occurredAt, end.occurredAt) : null;

  const gym = todayEvents.filter((e) => e.type === 'gym-session');
  const gymMins = gym.reduce((sum, e) => sum + (e.sessionDuration ?? 0), 0);
  const lifts = gym.reduce((sum, e) => sum + (e.exercises?.length ?? 0), 0);

  const caffeine = todayEvents
    .filter((e) => e.type === 'caffeine')
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const lastCaf = caffeine[caffeine.length - 1];
  const timeState = lastCaf ? evaluate(CAFFEINE_TIME_GOAL, wallMinutes(lastCaf.occurredAt)) : 'goal';
  const countState = evaluate(CAFFEINE_COUNT_GOAL, caffeine.length);
  const late = isBreach(timeState);
  const tooMany = isBreach(countState);

  // Sleep is a band: a long night is a deviation, not a better score.
  const sleepState = evaluate(SLEEP_GOAL, night);

  // Protein accumulates through the day, so its verdict depends on the hour.
  const nowParts = wallParts(new Date().toISOString());
  const hourOfDay = nowParts ? nowParts.hour + nowParts.minute / 60 : 12;
  const pace = paceState(protein, PROTEIN_GOAL.min, hourOfDay);

  return (
    <div className={styles.sec}>
      <span className={styles.eyebrow}>Today&apos;s goals</span>
      <div className={styles.cards}>
        <Card
          title="Protein"
          icon="meal"
          status={protein >= PROTEIN_GOAL.min ? 'done' : pace.behind ? 'warn' : 'open'}
          n={
            <>
              {protein}
              <small>/ {PROTEIN_GOAL.min} g</small>
            </>
          }
          pace={{ value: protein, goal: PROTEIN_GOAL.min, hourOfDay }}
          s={
            protein >= PROTEIN_GOAL.min
              ? 'Target met'
              : pace.behind
                ? `${pace.diff} g behind pace · ${PROTEIN_GOAL.min - protein} g to go`
                : `${pace.diff} g ahead of pace · ${PROTEIN_GOAL.min - protein} g to go`
          }
        />
        <Card
          title="Sleep"
          icon="sleep"
          status={sleepState === 'goal' ? 'done' : sleepState === 'none' ? 'open' : 'warn'}
          n={
            night !== null ? (
              <>
                {`${Math.floor(night / 60)}:${String(night % 60).padStart(2, '0')}`}
                <small>h</small>
              </>
            ) : (
              <>
                —<small>h</small>
              </>
            )
          }
          bar={night !== null ? (night / SLEEP_GOAL.max) * 100 : 0}
          s={
            start && end && night !== null
              ? `${wallHHMM(start.occurredAt)} → ${wallHHMM(end.occurredAt)} · ${
                  sleepState === 'goal'
                    ? 'in range'
                    : night < SLEEP_GOAL.min
                      ? `${formatDuration(SLEEP_GOAL.min - night)} below range`
                      : `${formatDuration(night - SLEEP_GOAL.max)} above range`
                }`
              : 'No night logged yet'
          }
        />
        <Card
          title="Gym"
          icon="gym"
          status={gym.length > 0 ? 'done' : 'open'}
          n={
            gym.length > 0 ? (
              <>
                {gymMins}
                <small>min</small>
              </>
            ) : (
              <>
                —<small>min</small>
              </>
            )
          }
          s={gym.length > 0 ? `Done${lifts > 0 ? ` · ${lifts} lifts` : ''}` : 'No session yet'}
        />
        <Card
          title="Caffeine"
          icon="coffee"
          status={late || tooMany ? 'warn' : 'done'}
          small
          n={
            lastCaf ? (
              <>
                {wallHHMM(lastCaf.occurredAt)}
                <small>
                  ×{caffeine.length}
                </small>
              </>
            ) : (
              <>
                —<small>none</small>
              </>
            )
          }
          s={
            lastCaf === undefined
              ? 'None today'
              : tooMany && late
                ? `${caffeine.length} today and past 16:00`
                : tooMany
                  ? `${caffeine.length} today · over ${CAFFEINE_COUNT_GOAL.max}`
                  : late
                    ? "After 16:00 · don't take more"
                    : 'Before cutoff · clear'
          }
        />
      </div>
    </div>
  );
}
