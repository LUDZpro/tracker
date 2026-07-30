'use client';

import { Icon } from '@/components/desktop/presentation';
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
import PaceBar, { paceState } from '@/components/charts/PaceBar';
import type { AppEvent, TodayResponse } from '@/lib/types';
import styles from './home.module.css';

type Status = 'done' | 'warn' | 'open';

const STATUS_CLASS: Record<Status, string> = {
  done: styles.statusDone,
  warn: styles.statusWarn,
  open: styles.statusOpen,
};

function StatusDot({ status }: { status: Status }) {
  return (
    <span className={`${styles.statusDot} ${STATUS_CLASS[status]}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {status === 'warn' ? <path d="M12 6v7M12 17h.01" /> : <path d="M20 6 9 17l-5-5" />}
      </svg>
    </span>
  );
}

function GoalCard({
  title,
  icon,
  status,
  value,
  bar,
  pace,
  summary,
  small,
}: {
  title: string;
  icon: 'meal' | 'sleep' | 'gym' | 'coffee';
  status: Status;
  value: React.ReactNode;
  bar?: number;
  pace?: { value: number; goal: number; hourOfDay: number };
  summary: string;
  small?: boolean;
}) {
  return (
    <article className={styles.goalCard}>
      <StatusDot status={status} />
      <div className={styles.goalTitle}>
        <Icon name={icon} size={12} />
        {title}
      </div>
      <div className={`${styles.goalValue} ${small ? styles.goalValueSmall : ''}`}>{value}</div>
      {pace !== undefined ? (
        <PaceBar value={pace.value} goal={pace.goal} hourOfDay={pace.hourOfDay} />
      ) : (
        bar !== undefined && (
          <div className={styles.goalBar}>
            <i style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
          </div>
        )
      )}
      <div className={styles.goalSummary}>{summary}</div>
    </article>
  );
}

interface Props {
  today: TodayResponse;
  todayEvents: AppEvent[];
}

export default function MobileGoalCards({ today, todayEvents }: Props) {
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
  const late = isBreach(timeState);
  const tooMany = isBreach(evaluate(CAFFEINE_COUNT_GOAL, caffeine.length));

  // Sleep is a band; protein accumulates, so its verdict depends on the hour.
  const sleepState = evaluate(SLEEP_GOAL, night);
  const nowParts = wallParts(new Date().toISOString());
  const hourOfDay = nowParts ? nowParts.hour + nowParts.minute / 60 : 12;
  const pace = paceState(protein, PROTEIN_GOAL.min, hourOfDay);

  return (
    <section className={styles.section}>
      <span className={styles.eyebrow}>Today&apos;s goals</span>
      <div className={styles.goals}>
        <GoalCard
          title="Protein"
          icon="meal"
          status={protein >= PROTEIN_GOAL.min ? 'done' : pace.behind ? 'warn' : 'open'}
          value={
            <>
              {protein}
              <small>/ {PROTEIN_GOAL.min} g</small>
            </>
          }
          pace={{ value: protein, goal: PROTEIN_GOAL.min, hourOfDay }}
          summary={
            protein >= PROTEIN_GOAL.min
              ? 'Target met'
              : pace.behind
                ? `${pace.diff} g behind pace`
                : `${pace.diff} g ahead of pace`
          }
        />
        <GoalCard
          title="Sleep"
          icon="sleep"
          status={sleepState === 'goal' ? 'done' : sleepState === 'none' ? 'open' : 'warn'}
          value={
            night !== null ? (
              <>
                {`${Math.floor(night / 60)}:${String(night % 60).padStart(2, '0')}`}
                <small>h</small>
              </>
            ) : (
              <>
                -<small>h</small>
              </>
            )
          }
          bar={night !== null ? (night / SLEEP_GOAL.max) * 100 : 0}
          summary={
            start && end && night !== null
              ? `${wallHHMM(start.occurredAt)} -> ${wallHHMM(end.occurredAt)} · ${
                  sleepState === 'goal'
                    ? 'in range'
                    : night < SLEEP_GOAL.min
                      ? `${formatDuration(SLEEP_GOAL.min - night)} below range`
                      : `${formatDuration(night - SLEEP_GOAL.max)} above range`
                }`
              : 'No night logged yet'
          }
        />
        <GoalCard
          title="Gym"
          icon="gym"
          status={gym.length > 0 ? 'done' : 'open'}
          value={
            gym.length > 0 ? (
              <>
                {gymMins}
                <small>min</small>
              </>
            ) : (
              <>
                -<small>min</small>
              </>
            )
          }
          summary={gym.length > 0 ? `Done${lifts > 0 ? ` · ${lifts} lifts` : ''}` : 'No session yet'}
        />
        <GoalCard
          title="Caffeine"
          icon="coffee"
          status={late || tooMany ? 'warn' : 'done'}
          small
          value={
            lastCaf ? (
              <>
                {wallHHMM(lastCaf.occurredAt)}
                <small>x{caffeine.length}</small>
              </>
            ) : (
              <>
                -<small>none</small>
              </>
            )
          }
          summary={
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
    </section>
  );
}
