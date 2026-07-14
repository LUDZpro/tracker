'use client';

import type { LastLogged } from '@/hooks/useLogger';
import styles from './home.module.css';

interface Props {
  last: LastLogged | null;
  canUndo: boolean;
  onUndo: () => void;
  /** Opens the edit sheet for the just-logged event (needs a server id). */
  onEdit?: (last: LastLogged) => void;
}

/** "last: {event} {HH:MM} ✓" with [edit] [undo] for 12 seconds. */
export default function LastLine({ last, canUndo, onUndo, onEdit }: Props) {
  if (!last) return null;
  return (
    <p className={styles.lastLine} aria-live="polite">
      <span className="num">
        last: {last.label} {last.queued ? '(queued)' : '✓'}
      </span>
      {canUndo && onEdit && last.id && last.payload.type !== 'nap' && (
        <button className={styles.undoBtn} onClick={() => onEdit(last)}>
          edit
        </button>
      )}
      {canUndo && (
        <button className={styles.undoBtn} onClick={onUndo}>
          undo
        </button>
      )}
    </p>
  );
}
