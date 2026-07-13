'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CaptureColumn, { KEY_TO_SHEET, type DesktopSheet } from './CaptureColumn';
import GoalCards from './GoalCards';
import Ledger from './Ledger';
import Topbar from './Topbar';
import WeekStats from './WeekStats';
import QueueBanner from '@/components/home/QueueBanner';
import CaffeineSheet from '@/components/sheets/CaffeineSheet';
import EditEventSheet from '@/components/sheets/EditEventSheet';
import GymSheet from '@/components/sheets/GymSheet';
import MealSheet from '@/components/sheets/MealSheet';
import NapSheet from '@/components/sheets/NapSheet';
import TimeSheet from '@/components/sheets/TimeSheet';
import DuplicateCard, { type DuplicateAttempt } from '@/components/sleep/DuplicateCard';
import { useLogger } from '@/hooks/useLogger';
import { useQueue } from '@/hooks/useQueue';
import { useToday } from '@/hooks/useToday';
import { useWeek } from '@/hooks/useWeek';
import { undoEvent } from '@/lib/client/api';
import { shiftDateKey, toLocalISO, wallDateKey } from '@/lib/time';
import { CATEGORY_BY_TYPE, type AppEvent, type EventPayload } from '@/lib/types';
import styles from './desktop.module.css';

const DELETE_UNDO_MS = 5000;

/** Optimistic row shown until the next refresh lands (mirrors mobile Home). */
function ghostEvent(payload: EventPayload): AppEvent {
  return {
    id: `ghost-${crypto.randomUUID()}`,
    type: payload.type,
    category: CATEGORY_BY_TYPE[payload.type],
    occurredAt: payload.occurred_at,
    precision: payload.precision,
    ...(payload.duration !== undefined ? { duration: payload.duration } : {}),
    ...(payload.intensity !== undefined ? { intensity: payload.intensity } : {}),
    ...(payload.kind !== undefined ? { kind: payload.kind } : {}),
    ...(payload.mealName !== undefined ? { mealName: payload.mealName } : {}),
    ...(payload.proteinG !== undefined ? { proteinG: payload.proteinG } : {}),
    ...(payload.calories !== undefined ? { calories: payload.calories } : {}),
    ...(payload.sessionDuration !== undefined
      ? { sessionDuration: payload.sessionDuration }
      : {}),
    ...(payload.exercises !== undefined ? { exercises: payload.exercises } : {}),
    editable: false,
  };
}

function dedupeById(events: readonly AppEvent[]): AppEvent[] {
  const map = new Map<string, AppEvent>();
  for (const e of events) map.set(e.id, e); // later entries win
  return [...map.values()];
}

export default function DesktopHome() {
  const { today, error: loadError, refresh } = useToday(0);
  const { week, error: weekError, refresh: refreshWeek } = useWeek();
  const refreshAll = useCallback(() => {
    refresh();
    refreshWeek();
  }, [refresh, refreshWeek]);
  const logger = useLogger(refreshAll);
  const queued = useQueue(useCallback(() => refreshAll(), [refreshAll]));

  const [sheet, setSheet] = useState<DesktopSheet | null>(null);
  const [editing, setEditing] = useState<AppEvent | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateAttempt | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ghosts, setGhosts] = useState<AppEvent[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<ReadonlySet<string>>(new Set());
  const deleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Week is the superset — a fresh payload supersedes optimistic rows.
  useEffect(() => setGhosts([]), [week]);
  useEffect(() => {
    if (logger.error) setGhosts([]);
  }, [logger.error]);
  useEffect(() => {
    const timers = deleteTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const log = useCallback(
    (payload: EventPayload, label: string) => {
      // Stale-screen protection: repeating the current sleep state gets a
      // resolution card, never a silent double log (same rule as mobile).
      if (
        today &&
        payload.type === 'wake_up' &&
        today.state === 'awake' &&
        today.last_sleep.end
      ) {
        setDuplicate({
          type: payload.type,
          occurredAt: payload.occurred_at,
          precision: payload.precision,
          existing: today.last_sleep.end,
        });
        return;
      }
      if (
        today &&
        payload.type === 'sleep_start' &&
        today.state === 'asleep' &&
        today.last_sleep.start
      ) {
        setDuplicate({
          type: payload.type,
          occurredAt: payload.occurred_at,
          precision: payload.precision,
          existing: today.last_sleep.start,
        });
        return;
      }
      setGhosts((g) => [...g, ghostEvent(payload)]);
      logger.log(payload, label);
    },
    [today, logger],
  );

  const requestDelete = useCallback(
    (ev: AppEvent) => {
      if (ev.id.startsWith('ghost-') || ev.editable === false) return;
      setPendingDeletes((prev) => new Set(prev).add(ev.id));
      const timer = setTimeout(async () => {
        deleteTimers.current.delete(ev.id);
        try {
          await undoEvent(ev.id); // archive — reversible in Notion
        } finally {
          setPendingDeletes((prev) => {
            const next = new Set(prev);
            next.delete(ev.id);
            return next;
          });
          refreshAll();
        }
      }, DELETE_UNDO_MS);
      deleteTimers.current.set(ev.id, timer);
    },
    [refreshAll],
  );

  const undoDelete = useCallback((id: string) => {
    const timer = deleteTimers.current.get(id);
    if (timer) clearTimeout(timer);
    deleteTimers.current.delete(id);
    setPendingDeletes((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const openRow = useCallback((ev: AppEvent) => {
    if (ev.id.startsWith('ghost-')) return; // still syncing
    setSelectedId(ev.id);
    setEditing(ev);
  }, []);

  // One dataset feeds the timeline, cards, and ledger: the week superset
  // overlaid with the floor window (fresher editable flags) and ghosts.
  const todayKey = today ? wallDateKey(today.now) : null;
  const allEvents = useMemo(() => {
    const floor = today ? [...today.events] : [];
    const opener = today?.last_sleep.start;
    if (opener && !floor.some((e) => e.id === opener.id)) floor.push(opener);
    return dedupeById([...(week?.events ?? []), ...floor, ...ghosts]);
  }, [today, week, ghosts]);

  const todayEvents = useMemo(
    () => (todayKey ? allEvents.filter((e) => wallDateKey(e.occurredAt) === todayKey) : []),
    [allEvents, todayKey],
  );
  const yesterdayEvents = useMemo(() => {
    if (!todayKey) return [];
    const yKey = shiftDateKey(todayKey, -1);
    return allEvents.filter((e) => wallDateKey(e.occurredAt) === yKey);
  }, [allEvents, todayKey]);

  const visibleEvents = useMemo(
    () => allEvents.filter((e) => !pendingDeletes.has(e.id)),
    [allEvents, pendingDeletes],
  );

  // Keyboard: capture shortcuts, ledger walking, edit/delete, escape.
  useEffect(() => {
    const sortedToday = [...todayEvents]
      .filter((e) => !pendingDeletes.has(e.id))
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
      if (e.key === 'Escape') {
        setSheet(null);
        setEditing(null);
        setSelectedId(null);
        return;
      }
      if (sheet || editing) return; // a dialog owns the keyboard
      const upper = e.key.toUpperCase();
      if (KEY_TO_SHEET[upper] && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setSheet(KEY_TO_SHEET[upper]);
        return;
      }
      if (sortedToday.length === 0) return;
      const idx = sortedToday.findIndex((ev) => ev.id === selectedId);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedId(sortedToday[Math.min(sortedToday.length - 1, idx + 1)].id);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedId(sortedToday[Math.max(0, idx - 1)].id);
      } else if (e.key === 'Enter' && idx >= 0) {
        openRow(sortedToday[idx]);
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && idx >= 0) {
        e.preventDefault();
        requestDelete(sortedToday[idx]);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheet, editing, selectedId, todayEvents, pendingDeletes, openRow, requestDelete]);

  // [adjust time] on the toast: reopen the just-logged event in the editor.
  const editLast = () => {
    const l = logger.last;
    if (!l?.id) return;
    setEditing({
      id: l.id,
      type: l.payload.type,
      category: CATEGORY_BY_TYPE[l.payload.type],
      occurredAt: l.payload.occurred_at,
      precision: l.payload.precision,
      ...(l.payload.duration !== undefined ? { duration: l.payload.duration } : {}),
      ...(l.payload.intensity !== undefined ? { intensity: l.payload.intensity } : {}),
      ...(l.payload.kind !== undefined ? { kind: l.payload.kind } : {}),
      ...(l.payload.mealName !== undefined ? { mealName: l.payload.mealName } : {}),
      editable: true,
    });
  };

  const nowIso = today?.now ?? toLocalISO(new Date());
  const caffeineKind =
    sheet === 'coffee' ? 'coffee' : sheet === 'tea' ? 'tea' : sheet === 'energy-drink' ? 'energy' : null;

  return (
    <div className={styles.main}>
      <Topbar today={today} events={visibleEvents} onOpen={openRow} />

      <div className={styles.grid}>
        <section className={styles.col} aria-label="Capture">
          <CaptureColumn
            todayEvents={todayEvents.filter((e) => !pendingDeletes.has(e.id))}
            onLogNow={log}
            onOpenSheet={setSheet}
          />
          {logger.error && (
            <p className="error-inline">
              {logger.error}
              <button onClick={logger.retry}>retry</button>
            </p>
          )}
        </section>

        <section className={`${styles.col} ${styles.mid}`} aria-label="Today">
          {queued > 0 && <QueueBanner count={queued} />}
          {duplicate && (
            <DuplicateCard
              attempt={duplicate}
              onResolved={() => {
                setDuplicate(null);
                refreshAll();
              }}
              onCancel={() => setDuplicate(null)}
            />
          )}
          {today && todayKey ? (
            <>
              <GoalCards today={today} todayEvents={todayEvents} />
              <Ledger
                todayKey={todayKey}
                todayEvents={todayEvents}
                yesterdayEvents={yesterdayEvents}
                lastSleep={today.last_sleep}
                selectedId={selectedId}
                pendingDeleteIds={pendingDeletes}
                onSelect={setSelectedId}
                onOpen={openRow}
                onDelete={requestDelete}
                onUndoDelete={undoDelete}
              />
            </>
          ) : (
            <p className={styles.emptyHint}>{loadError ?? 'Loading…'}</p>
          )}
        </section>

        <section className={styles.col} aria-label="Last 7 days">
          {todayKey && <WeekStats week={week} todayKey={todayKey} error={weekError} />}
        </section>
      </div>

      <footer className={styles.foot}>
        <span>↑↓ walk · ⏎ edit · ⌫ delete · esc clear</span>
        <span className={styles.footH}>click opens the control · hold to log now</span>
      </footer>

      {logger.last && logger.canUndo && (
        <div className={styles.toast} role="status">
          <span className={styles.toastDot} aria-hidden>
            ●
          </span>
          <span>{logger.last.label}</span>
          {logger.last.id && (
            <button className={styles.toastA} onClick={editLast}>
              adjust time
            </button>
          )}
          <button className={styles.toastU} onClick={logger.undo}>
            undo
          </button>
        </div>
      )}

      {(sheet === 'wake' || sheet === 'sleep') && (
        <TimeSheet
          title={sheet === 'wake' ? "I'm awake" : 'Going to sleep'}
          confirmLabel="Log it"
          initialIso={toLocalISO(new Date())}
          nowIso={nowIso}
          allowPrevDay
          onConfirm={(iso) => {
            log(
              {
                type: sheet === 'wake' ? 'wake_up' : 'sleep_start',
                occurred_at: iso,
                precision: 'exact',
              },
              sheet === 'wake' ? "I'm awake" : 'Going to sleep',
            );
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {caffeineKind && (
        <CaffeineSheet
          initialKind={caffeineKind}
          pickTime
          onLog={log}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'nap' && <NapSheet pickTime onLog={log} onClose={() => setSheet(null)} />}
      {sheet === 'meal' && <MealSheet onLog={log} onClose={() => setSheet(null)} />}
      {sheet === 'gym' && <GymSheet onLog={log} onClose={() => setSheet(null)} />}
      {editing && (
        <EditEventSheet
          event={editing}
          nowIso={nowIso}
          onClose={() => setEditing(null)}
          onSaved={refreshAll}
          onDelete={requestDelete}
        />
      )}
    </div>
  );
}
