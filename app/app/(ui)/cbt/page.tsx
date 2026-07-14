'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import CbtInsights from '@/components/cbt/CbtInsights';
import RecordCard from '@/components/cbt/RecordCard';
import ThoughtRecordFlow from '@/components/cbt/ThoughtRecordFlow';
import { deleteCbtRecord } from '@/lib/client/cbt';
import { useCbtRecords } from '@/hooks/useCbtRecords';
import { toLocalISO, wallDateKey } from '@/lib/time';
import type { CbtRecord } from '@/lib/cbt/types';
import styles from '@/components/cbt/cbt.module.css';

const DELETE_UNDO_MS = 5000;

export default function CbtPage() {
  const { records, hasMore, loading, error, loadMore, refresh } = useCbtRecords();
  const [flowOpen, setFlowOpen] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState<ReadonlySet<string>>(new Set());
  const deleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = deleteTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const requestDelete = useCallback(
    (record: CbtRecord) => {
      navigator.vibrate?.(30);
      setPendingDeletes((prev) => new Set(prev).add(record.id));
      const timer = setTimeout(async () => {
        deleteTimers.current.delete(record.id);
        try {
          await deleteCbtRecord(record.id); // archive — reversible in Notion
        } finally {
          setPendingDeletes((prev) => {
            const next = new Set(prev);
            next.delete(record.id);
            return next;
          });
          refresh();
        }
      }, DELETE_UNDO_MS);
      deleteTimers.current.set(record.id, timer);
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

  const todayKey = wallDateKey(toLocalISO(new Date()));

  return (
    <main className={styles.wrap}>
      <header className={styles.pageHeader}>
        <h1>Mind</h1>
        <p>Catch the thought, weigh it, let the numbers show it losing its grip.</p>
      </header>

      <button type="button" className={styles.ctaCard} onClick={() => setFlowOpen(true)}>
        <svg viewBox="0 0 64 56" className={styles.ctaTriangle} aria-hidden>
          <path d="M32 6 L58 48 H6 Z" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="32" cy="6" r="3.6" fill="var(--accent)" stroke="none" />
          <circle cx="58" cy="48" r="3.6" fill="var(--warn)" stroke="none" />
          <circle cx="6" cy="48" r="3.6" fill="var(--cyan)" stroke="none" />
        </svg>
        <span className={styles.ctaText}>
          <b>New thought record</b>
          <span>7 guided steps · ~3 minutes</span>
        </span>
        <span className={styles.ctaArrow} aria-hidden>
          →
        </span>
      </button>

      {error && <p className="error-inline">{error}</p>}

      <CbtInsights records={records} />

      {records.length === 0 && !loading && (
        <p className={styles.emptyHint}>
          No records yet. Next time a thought starts looping, catch it here instead of arguing
          with it in your head.
        </p>
      )}

      <div className={styles.cardList}>
        {records.map((r) =>
          pendingDeletes.has(r.id) ? (
            <div key={r.id} className={styles.undoRow}>
              <span>deleted</span>
              <button type="button" onClick={() => undoDelete(r.id)}>
                Undo
              </button>
            </div>
          ) : (
            <RecordCard key={r.id} record={r} todayKey={todayKey} onDelete={requestDelete} />
          ),
        )}
      </div>

      {hasMore && (
        <button className="chip" onClick={loadMore} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}

      {flowOpen && <ThoughtRecordFlow onClose={() => setFlowOpen(false)} onSaved={refresh} />}
    </main>
  );
}
