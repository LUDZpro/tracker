'use client';

import { EventIcon, rowText, toneFor } from './presentation';
import { formatHhMm } from '@/lib/weekStats';
import { minutesBetween, shiftDateKey, wallHHMM } from '@/lib/time';
import type { AppEvent, TodayResponse } from '@/lib/types';
import styles from './desktop.module.css';

const TONE_CLASS: Record<string, string> = {
  sleep: styles.cSleep,
  intake: styles.cIntake,
  meal: styles.cMeal,
  gym: styles.cGym,
  state: styles.cState,
};

function proteinOf(events: readonly AppEvent[]): number {
  return events
    .filter((e) => e.type === 'meal')
    .reduce((sum, e) => sum + (e.proteinG ?? 0), 0);
}

function dayHeadline(events: readonly AppEvent[]): string {
  const grams = proteinOf(events);
  const entries = `${events.length} ${events.length === 1 ? 'entry' : 'entries'}`;
  return grams > 0 ? `${entries} · ${grams} g` : entries;
}

function fmtDayLabel(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

interface RowProps {
  ev: AppEvent;
  selected: boolean;
  onSelect: (id: string) => void;
  onOpen: (ev: AppEvent) => void;
  onDelete: (ev: AppEvent) => void;
}

function Row({ ev, selected, onSelect, onOpen, onDelete }: RowProps) {
  const { main, meta, value } = rowText(ev);
  const tone = TONE_CLASS[toneFor(ev.type)];
  return (
    <div
      className={`${styles.row} ${selected ? styles.rowSel : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(ev.id)}
      onDoubleClick={() => onOpen(ev)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(ev);
      }}
    >
      <time className={styles.rowT}>{wallHHMM(ev.occurredAt)}</time>
      <span className={`${styles.rowG} ${tone}`}>
        <EventIcon ev={ev} />
      </span>
      <span className={styles.rowTxt}>
        {main}
        {meta ? <em> · {meta}</em> : null}
      </span>
      {ev.editable === false && (
        <span className={styles.rowLock} aria-label="read-only">
          read-only
        </span>
      )}
      <span className={styles.rowV}>{value ?? '›'}</span>
      <span className={styles.rowAct}>
        <button
          className={styles.rowActE}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(ev);
          }}
        >
          edit
        </button>
        <button
          className={styles.rowActD}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(ev);
          }}
        >
          del
        </button>
      </span>
    </div>
  );
}

interface Props {
  todayKey: string;
  /** Merged floor + meal/gym events for today, ghosts included. */
  todayEvents: AppEvent[];
  /** All of yesterday's events (from /api/week). */
  yesterdayEvents: AppEvent[];
  lastSleep: TodayResponse['last_sleep'];
  selectedId: string | null;
  pendingDeleteIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onOpen: (ev: AppEvent) => void;
  onDelete: (ev: AppEvent) => void;
  onUndoDelete: (id: string) => void;
}

/** Middle-column record: today (editable) plus yesterday for context. */
export default function Ledger({
  todayKey,
  todayEvents,
  yesterdayEvents,
  lastSleep,
  selectedId,
  pendingDeleteIds,
  onSelect,
  onOpen,
  onDelete,
  onUndoDelete,
}: Props) {
  const desc = (list: readonly AppEvent[]) =>
    [...list].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  const { start, end } = lastSleep;
  const night =
    start && end
      ? `${wallHHMM(start.occurredAt)} → ${wallHHMM(end.occurredAt)} · ${formatHhMm(
          minutesBetween(start.occurredAt, end.occurredAt),
        )}`
      : null;

  const renderRows = (list: readonly AppEvent[]) =>
    desc(list).map((ev) =>
      pendingDeleteIds.has(ev.id) ? (
        <div key={ev.id} className={styles.undoRow}>
          <span>deleted</span>
          <button className={styles.undoBtn} onClick={() => onUndoDelete(ev.id)}>
            Undo
          </button>
        </div>
      ) : (
        <Row
          key={ev.id}
          ev={ev}
          selected={ev.id === selectedId}
          onSelect={onSelect}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      ),
    );

  return (
    <div className={styles.sec}>
      <span className={styles.eyebrow}>Record</span>
      <div className={styles.dayhd}>
        <span className={styles.dayhdL}>Today · {fmtDayLabel(todayKey)}</span>
        <span className={styles.dayhdR}>{dayHeadline(todayEvents)}</span>
      </div>
      {todayEvents.length === 0 ? (
        <p className={styles.emptyHint}>Nothing logged yet today — first tap starts the day.</p>
      ) : (
        renderRows(todayEvents)
      )}
      {night && start && (
        <div className={styles.nightrow}>
          <span className={styles.cSleep} aria-hidden>
            <EventIcon ev={start} size={14} />
          </span>
          <span>Night · {night}</span>
          <button className={styles.nightEdit} onClick={() => onOpen(start)}>
            edit
          </button>
        </div>
      )}
      {yesterdayEvents.length > 0 && (
        <>
          <div className={styles.dayhd} style={{ paddingTop: 14 }}>
            <span className={styles.dayhdL}>
              Yesterday · {fmtDayLabel(shiftDateKey(todayKey, -1))}
            </span>
            <span className={styles.dayhdR}>{dayHeadline(yesterdayEvents)}</span>
          </div>
          {renderRows(yesterdayEvents)}
        </>
      )}
    </div>
  );
}
