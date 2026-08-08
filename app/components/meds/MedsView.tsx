'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EditEventSheet from '@/components/sheets/EditEventSheet';
import QueueBanner from '@/components/home/QueueBanner';
import MedsTodayStrip from './MedsTodayStrip';
import SubstanceGrid from './SubstanceGrid';
import SupplementSheet from './SupplementSheet';
import { clearLandedGhosts, ghostEvent } from './ghost';
import { useLogger } from '@/hooks/useLogger';
import { useQueue } from '@/hooks/useQueue';
import { useSubstances } from '@/hooks/useSubstances';
import { useWeek } from '@/hooks/useWeek';
import { undoEvent } from '@/lib/client/api';
import type { Substance } from '@/lib/substances/types';
import { toLocalISO, wallDateKey } from '@/lib/time';
import type { AppEvent, EventPayload } from '@/lib/types';
import styles from './meds.module.css';

const DELETE_UNDO_MS = 5000;

export default function MedsView() {
  const { substances, error: registryError } = useSubstances();
  // /api/week already carries every type for the last 8 days and is cached
  // alongside today — no new read route for one day of one type.
  const { week, refresh } = useWeek();
  const logger = useLogger(refresh);
  const queued = useQueue(refresh);

  const [sheetFor, setSheetFor] = useState<Substance | null>(null);
  const [editing, setEditing] = useState<AppEvent | null>(null);
  const [ghosts, setGhosts] = useState<AppEvent[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<ReadonlySet<string>>(new Set());
  const deleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Clear a ghost only once its real row lands, never on every refresh: a
  // dose queued offline has no server row to come back, and blanket-clearing
  // would make the pending dose vanish from the one list whose job is telling
  // you whether you already took it.
  // Depends on `week` (the fetched object), never on a derived array — a
  // freshly-built array here would re-run every render and stall the router.
  useEffect(() => {
    if (!week) return;
    setGhosts((prev) => clearLandedGhosts(prev, week.events));
  }, [week]);
  useEffect(() => {
    if (logger.error) setGhosts([]);
  }, [logger.error]);
  useEffect(() => {
    const timers = deleteTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const todayKey = wallDateKey(toLocalISO(new Date()));

  const todayDoses = useMemo(() => {
    const real = (week?.events ?? []).filter(
      (e) => e.type === 'supplement' && wallDateKey(e.occurredAt) === todayKey,
    );
    return [...real, ...ghosts]
      .filter((e) => !pendingDeletes.has(e.id))
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  }, [week, ghosts, pendingDeletes, todayKey]);

  // The grid's "already taken?" line must include rows queued offline, or the
  // view would invite exactly the double-dose it exists to prevent.
  const log = useCallback(
    (payload: EventPayload, label: string) => {
      setGhosts((g) => [...g, ghostEvent(payload)]);
      logger.log(payload, label);
    },
    [logger],
  );

  const requestDelete = useCallback(
    (ev: AppEvent) => {
      navigator.vibrate?.(30);
      setPendingDeletes((prev) => new Set(prev).add(ev.id));
      const timer = setTimeout(async () => {
        deleteTimers.current.delete(ev.id);
        try {
          await undoEvent(ev.id); // soft archive, same as everywhere else
        } finally {
          setPendingDeletes((prev) => {
            const next = new Set(prev);
            next.delete(ev.id);
            return next;
          });
          refresh();
        }
      }, DELETE_UNDO_MS);
      deleteTimers.current.set(ev.id, timer);
    },
    [refresh],
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

  const nowIso = toLocalISO(new Date());

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Meds</h1>
        <p className={styles.subtitle}>{todayKey}</p>
      </header>

      <QueueBanner count={queued} />

      {registryError && <p className="error-inline">{registryError}</p>}

      {substances === null ? (
        <p className={styles.emptyHint}>Loading…</p>
      ) : (
        <SubstanceGrid
          substances={substances}
          events={todayDoses}
          onLog={log}
          onOpen={setSheetFor}
        />
      )}

      {logger.last && logger.canUndo && (
        <div className={styles.undoToast} role="status">
          <span>
            {logger.last.label}
            {logger.last.queued ? ' · queued' : ''}
          </span>
          <button onClick={logger.undo}>undo</button>
        </div>
      )}

      {logger.error && (
        <p className="error-inline">
          {logger.error}
          <button onClick={logger.retry}>retry</button>
        </p>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.eyebrow}>Today</span>
          <span className={styles.count}>
            {todayDoses.length} {todayDoses.length === 1 ? 'dose' : 'doses'}
          </span>
        </div>
        <MedsTodayStrip
          events={todayDoses}
          substances={substances ?? []}
          pendingDeleteIds={pendingDeletes}
          onOpen={setEditing}
          onUndoDelete={undoDelete}
        />
      </section>

      {sheetFor && (
        <SupplementSheet
          substance={sheetFor}
          nowIso={nowIso}
          onLog={log}
          onClose={() => setSheetFor(null)}
        />
      )}

      {editing && (
        <EditEventSheet
          event={editing}
          nowIso={nowIso}
          onClose={() => setEditing(null)}
          onSaved={refresh}
          onDelete={requestDelete}
        />
      )}
    </main>
  );
}
