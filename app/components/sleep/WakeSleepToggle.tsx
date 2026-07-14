'use client';

import { Icon } from '../desktop/presentation';
import { useLongPress } from '@/hooks/useLongPress';
import { toLocalISO } from '@/lib/time';
import type { AppEvent, EventPayload } from '@/lib/types';
import styles from './wake-sleep.module.css';

interface Props {
  lastSleep: { start: AppEvent | null; end: AppEvent | null };
  onLog: (payload: EventPayload, label: string) => void;
  onOpenSheet: (sheet: 'wake' | 'sleep', withTime: boolean) => void;
  meta: { wake: string; sleep: string };
}

export default function WakeSleepToggle({ lastSleep, onLog, onOpenSheet, meta }: Props) {
  const isAsleep = lastSleep.start && !lastSleep.end;
  const canWake = Boolean(isAsleep);
  const canSleep = !isAsleep;

  const { guard: wakeGuard, handlers: wakeHandlers } = useLongPress(() => {
    if (canWake) onOpenSheet('wake', true);
  });

  const { guard: sleepGuard, handlers: sleepHandlers } = useLongPress(() => {
    if (canSleep) onOpenSheet('sleep', true);
  });

  return (
    <div className={styles.toggle}>
      <button
        className={`${styles.side} ${styles.wake} ${!canWake ? styles.disabled : ''}`}
        onClick={wakeGuard(() => {
          if (canWake) {
            onLog(
              { type: 'wake_up', occurred_at: toLocalISO(new Date()), precision: 'exact' },
              'Wake'
            );
          }
        })}
        disabled={!canWake}
        {...wakeHandlers}
      >
        <span className={styles.fill} aria-hidden />
        <Icon name="wake" size={18} />
        <span className={styles.label}>Wake</span>
        <span className={`${styles.meta} ${meta.wake ? styles.metaHit : ''}`}>
          {meta.wake || '—'}
        </span>
      </button>
      <button
        className={`${styles.side} ${styles.sleep} ${!canSleep ? styles.disabled : ''}`}
        onClick={sleepGuard(() => {
          if (canSleep) {
            onLog(
              { type: 'sleep_start', occurred_at: toLocalISO(new Date()), precision: 'exact' },
              'Sleep'
            );
          }
        })}
        disabled={!canSleep}
        {...sleepHandlers}
      >
        <span className={styles.fill} aria-hidden />
        <Icon name="sleep" size={18} />
        <span className={styles.label}>Sleep</span>
        <span className={`${styles.meta} ${meta.sleep ? styles.metaHit : ''}`}>
          {meta.sleep || '—'}
        </span>
      </button>
    </div>
  );
}
