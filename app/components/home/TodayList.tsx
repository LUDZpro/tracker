'use client';

import { useRef, useState } from 'react';
import { eventIcon, eventSummary, precisionBadge, COLOR_BY_CATEGORY } from './eventPresentation';
import { shiftDateKey, wallDateKey, wallHHMM } from '@/lib/time';
import type { AppEvent } from '@/lib/types';
import styles from './home.module.css';

const SWIPE_COMMIT_PX = 90;

interface Props {
  events: AppEvent[]; // the window's dataset, same payload as the strip
  nowIso: string;
  selectedId: string | null;
  pendingDeleteIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onOpen: (ev: AppEvent) => void;
  onDelete: (ev: AppEvent) => void;
  onUndoDelete: (id: string) => void;
}

function separatorLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'today';
  if (dateKey === shiftDateKey(todayKey, -1)) return 'yesterday';
  return dateKey;
}

function Row({
  ev,
  selected,
  onSelect,
  onOpen,
  onDelete,
}: {
  ev: AppEvent;
  selected: boolean;
  onSelect: (id: string) => void;
  onOpen: (ev: AppEvent) => void;
  onDelete: (ev: AppEvent) => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dragX, setDragX] = useState(0);
  const swipeable = ev.editable !== false;

  const onTouchStart = (e: React.TouchEvent) => {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current || !swipeable) return;
    const dx = e.touches[0].clientX - start.current.x;
    const dy = e.touches[0].clientY - start.current.y;
    // Horizontal intent only; let vertical scrolling win.
    if (Math.abs(dx) > Math.abs(dy)) setDragX(Math.min(0, dx));
  };
  const onTouchEnd = () => {
    if (dragX < -SWIPE_COMMIT_PX) {
      navigator.vibrate?.(30);
      onDelete(ev);
    }
    setDragX(0);
    start.current = null;
  };

  const badge = precisionBadge(ev);

  return (
    <li className={styles.rowSlot}>
      {dragX < -8 && <span className={styles.deleteReveal}>delete</span>}
      <button
        className={`${styles.row} ${selected ? styles.rowSelected : ''}`}
        style={dragX ? { transform: `translateX(${dragX}px)`, transition: 'none' } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => {
          onSelect(ev.id);
          onOpen(ev);
        }}
      >
        <time className={styles.rowTime}>{wallHHMM(ev.occurredAt)}</time>
        <span
          className={styles.rowIcon}
          style={{ color: COLOR_BY_CATEGORY[ev.category] }}
          aria-hidden
        >
          {eventIcon(ev)}
        </span>
        <span className={styles.rowLabel}>{eventSummary(ev)}</span>
        {badge && <span className={styles.rowBadge}>{badge}</span>}
        {ev.editable === false && <span className={styles.rowLock} aria-label="read-only">🔒</span>}
      </button>
    </li>
  );
}

/** Reverse-chronological readable record of the wake-window. */
export default function TodayList({
  events,
  nowIso,
  selectedId,
  pendingDeleteIds,
  onSelect,
  onOpen,
  onDelete,
  onUndoDelete,
}: Props) {
  if (events.length === 0) return null;

  const todayKey = wallDateKey(nowIso);
  const desc = [...events].sort(
    (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
  );

  const items: React.ReactNode[] = [];
  let prevKey: string | null = null;
  for (const ev of desc) {
    const key = wallDateKey(ev.occurredAt);
    if (prevKey !== null && key !== prevKey) {
      items.push(
        <li key={`sep-${key}`} className={styles.daySeparator} aria-hidden>
          ─ {separatorLabel(key, todayKey)} ─
        </li>,
      );
    }
    prevKey = key;
    if (pendingDeleteIds.has(ev.id)) {
      items.push(
        <li key={ev.id} className={styles.undoRow}>
          <span>deleted</span>
          <button className={styles.undoRowBtn} onClick={() => onUndoDelete(ev.id)}>
            Undo
          </button>
        </li>,
      );
    } else {
      items.push(
        <Row
          key={ev.id}
          ev={ev}
          selected={ev.id === selectedId}
          onSelect={onSelect}
          onOpen={onOpen}
          onDelete={onDelete}
        />,
      );
    }
  }

  return (
    <ul className={styles.todayList} aria-label="Logged events, newest first">
      {items}
    </ul>
  );
}
