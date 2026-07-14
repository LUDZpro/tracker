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
  const isAwake = !isAsleep;

  const { guard: wakeGuard, handlers: wakeHandlers } = useLongPress(() => {
    if (isAwake) onOpenSheet('wake', true);
  });

  const { guard: sleepGuard, handlers: sleepHandlers } = useLongPress(() => {
    if (isAsleep) onOpenSheet('sleep', true);
  });

  return (
    <div className={styles.toggle}>
      <button
        className={`${styles.side} ${styles.wake} ${!isAwake ? styles.disabled : ''}`}
        onClick={wakeGuard(() => {
          if (isAwake) {
            onLog(
              { type: 'wake_up', occurred_at: toLocalISO(new Date()), precision: 'exact' },
              'Wake'
            );
          }
        })}
        disabled={!isAwake}
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
        className={`${styles.side} ${styles.sleep} ${!isAsleep ? styles.disabled : ''}`}
        onClick={sleepGuard(() => {
          if (isAsleep) {
            onLog(
              { type: 'sleep_start', occurred_at: toLocalISO(new Date()), precision: 'exact' },
              'Sleep'
            );
          }
        })}
        disabled={!isAsleep}
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
