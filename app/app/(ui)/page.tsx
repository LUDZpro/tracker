'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ActionGrid, { type SheetKind } from '@/components/home/ActionGrid';
import HistoryPager from '@/components/home/HistoryPager';
import LastLine from '@/components/home/LastLine';
import QueueBanner from '@/components/home/QueueBanner';
import SleepCta from '@/components/home/SleepCta';
import TodayList from '@/components/home/TodayList';
import TodayStrip from '@/components/home/TodayStrip';
import CaffeineSheet from '@/components/sheets/CaffeineSheet';
import EditEventSheet from '@/components/sheets/EditEventSheet';
import NapSheet from '@/components/sheets/NapSheet';
import ScaleSheet from '@/components/sheets/ScaleSheet';
import DuplicateCard, { type DuplicateAttempt } from '@/components/sleep/DuplicateCard';
import MissingNightCard from '@/components/sleep/MissingNightCard';
import { useLogger, type LastLogged } from '@/hooks/useLogger';
import { useQueue } from '@/hooks/useQueue';
import { useToday } from '@/hooks/useToday';
import { undoEvent } from '@/lib/client/api';
import { isNightSkipped } from '@/lib/client/skips';
import { wallDateKey } from '@/lib/time';
import { CATEGORY_BY_TYPE, type AppEvent, type EventPayload } from '@/lib/types';
import styles from '@/components/home/home.module.css';

const MAX_OFFSET = 7;
const DELETE_UNDO_MS = 5000;

/** Optimistic row shown until the next /api/today refresh lands. */
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
    editable: false, // resolves to a real, tappable row on refresh
  };
}

export default function HomePage() {
  const [offset, setOffset] = useState(0);
  const [maxReached, setMaxReached] = useState<number | null>(null);
  const { today, error: loadError, refresh } = useToday(offset);
  const logger = useLogger(refresh);
  const queued = useQueue(useCallback(() => refresh(), [refresh]));
  const [sheet, setSheet] = useState<{ kind: SheetKind; withTime: boolean } | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateAttempt | null>(null);
  const [resolvedNight, setResolvedNight] = useState<string | null>(null);

  // PATCH-02 state: selection sync, edit sheet, ghosts, delete-with-undo.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AppEvent | null>(null);
  const [ghosts, setGhosts] = useState<AppEvent[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<ReadonlySet<string>>(new Set());
  const deleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // A fresh payload supersedes optimistic rows; a failed log discards them.
  useEffect(() => setGhosts([]), [today]);
  useEffect(() => {
    if (logger.error) setGhosts([]);
  }, [logger.error]);
  useEffect(() => {
    const timers = deleteTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  // History paging hits the end via 404 ("No more history").
  useEffect(() => {
    if (loadError === 'No more history' && offset > 0) {
      setMaxReached(offset);
      setOffset(offset - 1);
    }
  }, [loadError, offset]);

  const requestDelete = useCallback(
    (ev: AppEvent) => {
      navigator.vibrate?.(30);
      setPendingDeletes((prev) => new Set(prev).add(ev.id));
      const timer = setTimeout(async () => {
        deleteTimers.current.delete(ev.id);
        try {
          await undoEvent(ev.id); // archive — reversible in Notion, never hard delete
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

  const log = (payload: EventPayload, label: string) => {
    // A marker tap that repeats the current state gets a card, never a
    // silent double log (stale-screen protection).
    if (today && payload.type === 'wake_up' && today.state === 'awake' && today.last_sleep.end) {
      setDuplicate({
        type: payload.type,
        occurredAt: payload.occurred_at,
        precision: payload.precision,
        existing: today.last_sleep.end,
      });
      return;
    }
    if (today && payload.type === 'sleep_start' && today.state === 'asleep' && today.last_sleep.start) {
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
  };

  // Strip and list are two views of one dataset: the window's events plus
  // the sleep_start that opened it (it precedes the window), plus ghosts.
  const displayEvents = useMemo(() => {
    if (!today) return [];
    const base = [...today.events];
    const opener = today.last_sleep.start;
    if (opener && !base.some((e) => e.id === opener.id)) base.push(opener);
    return offset === 0 ? [...base, ...ghosts] : base;
  }, [today, ghosts, offset]);

  const stripEvents = useMemo(
    () => displayEvents.filter((e) => !pendingDeletes.has(e.id)),
    [displayEvents, pendingDeletes],
  );

  const openRow = (ev: AppEvent) => {
    if (ev.id.startsWith('ghost-')) return; // still syncing — one refresh away
    setEditing(ev);
  };

  // [edit] on the post-log strip: reopen the just-logged event in the sheet.
  const editLast = (l: LastLogged) => {
    if (!l.id) return;
    setEditing({
      id: l.id,
      type: l.payload.type,
      category: CATEGORY_BY_TYPE[l.payload.type],
      occurredAt: l.payload.occurred_at,
      precision: l.payload.precision,
      ...(l.payload.duration !== undefined ? { duration: l.payload.duration } : {}),
      ...(l.payload.intensity !== undefined ? { intensity: l.payload.intensity } : {}),
      ...(l.payload.kind !== undefined ? { kind: l.payload.kind } : {}),
      editable: true, // just logged — well inside the 48h window
    });
  };

  const live = offset === 0;
  const todayKey = today ? wallDateKey(today.now) : null;
  const showMissingBedtime =
    live &&
    today !== null &&
    todayKey !== null &&
    today.state === 'awake' &&
    today.last_sleep.end !== null && // only after a wake was actually logged
    today.missing_nights.includes(todayKey) &&
    !isNightSkipped(todayKey) &&
    resolvedNight !== todayKey;

  const canBack = offset < MAX_OFFSET && (maxReached === null || offset + 1 < maxReached);

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Floor Logger</h1>
        <Link href="/sleep" className={styles.navLink}>
          Sleep →
        </Link>
      </header>

      <QueueBanner count={queued} />

      {today ? (
        <>
          <HistoryPager
            offset={offset}
            axisDate={today.axis_date}
            nowIso={today.now}
            canBack={canBack}
            onBack={() => {
              setSelectedId(null);
              setOffset((o) => Math.min(o + 1, MAX_OFFSET));
            }}
            onForward={() => {
              setSelectedId(null);
              setOffset((o) => Math.max(o - 1, 0));
            }}
          />
          <TodayStrip
            today={today}
            events={stripEvents}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <TodayList
            events={displayEvents}
            nowIso={today.now}
            selectedId={selectedId}
            pendingDeleteIds={pendingDeletes}
            onSelect={setSelectedId}
            onOpen={openRow}
            onDelete={requestDelete}
            onUndoDelete={undoDelete}
          />
          {live && <SleepCta state={today.state} onLog={log} />}
          {live && duplicate && (
            <DuplicateCard
              attempt={duplicate}
              onResolved={() => {
                setDuplicate(null);
                refresh();
              }}
              onCancel={() => setDuplicate(null)}
            />
          )}
          {showMissingBedtime && todayKey && (
            <MissingNightCard
              night={todayKey}
              todayKey={todayKey}
              onDone={() => {
                setResolvedNight(todayKey);
                refresh();
              }}
            />
          )}
        </>
      ) : (
        <p className={styles.emptyHint}>{loadError ?? 'Loading…'}</p>
      )}

      {live && (
        <>
          <ActionGrid onOpen={(kind, withTime) => setSheet({ kind, withTime })} />
          <LastLine
            last={logger.last}
            canUndo={logger.canUndo}
            onUndo={logger.undo}
            onEdit={editLast}
          />
          {logger.error && (
            <p className="error-inline">
              {logger.error}
              <button onClick={logger.retry}>retry</button>
            </p>
          )}
        </>
      )}

      {sheet?.kind === 'nap' && (
        <NapSheet onLog={log} onClose={() => setSheet(null)} pickTime={sheet.withTime} />
      )}
      {sheet?.kind === 'caffeine' && (
        <CaffeineSheet onLog={log} onClose={() => setSheet(null)} pickTime={sheet.withTime} />
      )}
      {(sheet?.kind === 'mood' || sheet?.kind === 'energy') && (
        <ScaleSheet
          kind={sheet.kind}
          onLog={log}
          onClose={() => setSheet(null)}
          pickTime={sheet.withTime}
        />
      )}
      {editing && today && (
        <EditEventSheet
          event={editing}
          nowIso={today.now}
          onClose={() => setEditing(null)}
          onSaved={refresh}
          onDelete={requestDelete}
        />
      )}
    </main>
  );
}
