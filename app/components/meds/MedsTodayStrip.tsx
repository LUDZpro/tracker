'use client';

import { Icon } from '@/components/desktop/presentation';
import { labelForEvent } from '@/lib/substances/format';
import type { Substance } from '@/lib/substances/types';
import { wallHHMM } from '@/lib/time';
import type { AppEvent } from '@/lib/types';
import styles from './meds.module.css';

interface Props {
  events: readonly AppEvent[];
  substances: readonly Substance[];
  pendingDeleteIds: ReadonlySet<string>;
  onOpen: (ev: AppEvent) => void;
  onUndoDelete: (id: string) => void;
}

/**
 * Today's doses, newest last. The whole point of this list is answering
 * "did I already take it?", so a queued row still shows — it just says so.
 */
export default function MedsTodayStrip({
  events,
  substances,
  pendingDeleteIds,
  onOpen,
  onUndoDelete,
}: Props) {
  if (events.length === 0) {
    return <p className={styles.emptyHint}>Nothing logged today.</p>;
  }

  return (
    <ul className={styles.strip}>
      {events.map((ev) => {
        const pending = pendingDeleteIds.has(ev.id);
        const queued = ev.id.startsWith('ghost-');
        const name = substances.find((s) => s.id === ev.substance)?.name ?? ev.substance ?? 'Supplement';

        if (pending) {
          return (
            <li key={ev.id} className={`${styles.row} ${styles.rowPending}`}>
              <span className={styles.rowName}>Deleted {name}</span>
              <button className={styles.undoBtn} onClick={() => onUndoDelete(ev.id)}>
                undo
              </button>
            </li>
          );
        }

        return (
          <li key={ev.id} className={styles.row}>
            <button
              className={styles.rowBtn}
              onClick={() => !queued && onOpen(ev)}
              disabled={queued}
              aria-label={`${name} at ${wallHHMM(ev.occurredAt)}`}
            >
              <span className={styles.rowIcon} aria-hidden>
                <Icon name="pill" size={15} />
              </span>
              <span className={styles.rowBody}>
                <span className={styles.rowName}>{name}</span>
                <span className={styles.rowLabel}>
                  {labelForEvent(ev.substance, ev.dose, substances)}
                </span>
                {ev.note && <span className={styles.rowNote}>{ev.note}</span>}
              </span>
              <span className={styles.rowRight}>
                <span className={styles.rowTime}>{wallHHMM(ev.occurredAt)}</span>
                {queued && <span className={styles.rowQueued}>queued</span>}
                {!queued && ev.precision !== 'exact' && (
                  <span className={styles.rowPrecision}>{ev.precision}</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
