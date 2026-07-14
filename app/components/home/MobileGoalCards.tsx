'use client';

import { Icon } from '@/components/desktop/presentation';
import { CAFFEINE_CUTOFF_MIN, PROTEIN_TARGET_G } from '@/lib/weekStats';
import { minutesBetween, wallHHMM, wallMinutes } from '@/lib/time';
import type { AppEvent, TodayResponse } from '@/lib/types';
import styles from './home.module.css';

const SLEEP_GOAL_MIN = 8 * 60;

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
  summary,
  small,
}: {
  title: string;
  icon: 'meal' | 'sleep' | 'gym' | 'coffee';
  status: Status;
  value: React.ReactNode;
  bar?: number;
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
      {bar !== undefined && (
        <div className={styles.goalBar}>
          <i style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} />
        </div>
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
  const late = lastCaf !== undefined && wallMinutes(lastCaf.occurredAt) >= CAFFEINE_CUTOFF_MIN;

  return (
    <section className={styles.section}>
      <span className={styles.eyebrow}>Today&apos;s goals</span>
      <div className={styles.goals}>
        <GoalCard
          title="Protein"
          icon="meal"
          status={protein >= PROTEIN_TARGET_G ? 'done' : 'open'}
          value={
            <>
              {protein}
              <small>/ {PROTEIN_TARGET_G} g</small>
            </>
          }
          bar={(protein / PROTEIN_TARGET_G) * 100}
          summary={protein >= PROTEIN_TARGET_G ? 'Target met' : `${PROTEIN_TARGET_G - protein} g to go`}
        />
        <GoalCard
          title="Sleep"
          icon="sleep"
          status={night !== null && night >= 7 * 60 ? 'done' : night !== null ? 'warn' : 'open'}
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
          bar={night !== null ? (night / SLEEP_GOAL_MIN) * 100 : 0}
          summary={
            start && end
              ? `${wallHHMM(start.occurredAt)} -> ${wallHHMM(end.occurredAt)}${night !== null && night >= 7 * 60 ? ' · in range' : ''}`
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
          status={lastCaf === undefined ? 'done' : late ? 'warn' : 'done'}
          small
          value={
            lastCaf ? (
              <>
                {wallHHMM(lastCaf.occurredAt)}
                <small>last</small>
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
              : late
                ? "After 16:00 · don't take more"
                : 'Before cutoff · clear'
          }
        />
      </div>
    </section>
  );
}
