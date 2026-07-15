'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import EditEventSheet from '@/components/sheets/EditEventSheet';
import MealSheet from '@/components/sheets/MealSheet';
import LastLine from '@/components/home/LastLine';
import NutritionHistory from '@/components/nutrition/NutritionHistory';
import RecipeQuickLog from '@/components/nutrition/RecipeQuickLog';
import { clearLandedGhosts, ghostEvent } from '@/components/nutrition/ghost';
import { useHistory } from '@/hooks/useHistory';
import { useLogger } from '@/hooks/useLogger';
import { useRecipes } from '@/hooks/useRecipes';
import { undoEvent } from '@/lib/client/api';
import type { Recipe } from '@/lib/recipes/types';
import { toLocalISO } from '@/lib/time';
import type { AppEvent, EventPayload } from '@/lib/types';
import styles from '@/components/home/home.module.css';

const DELETE_UNDO_MS = 5000;

export default function MobileNutrition() {
  const { events, hasMore, loading, error: loadError, loadMore, refresh } = useHistory('meal');
  const logger = useLogger(refresh);
  const { recipes } = useRecipes();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AppEvent | null>(null);
  const [ghosts, setGhosts] = useState<AppEvent[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<ReadonlySet<string>>(new Set());
  const deleteTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => setGhosts((g) => clearLandedGhosts(g, events)), [events]);
  useEffect(() => {
    if (logger.error) setGhosts([]);
  }, [logger.error]);
  useEffect(() => {
    const timers = deleteTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const log = (payload: EventPayload, label: string) => {
    setGhosts((g) => [...g, ghostEvent(payload)]);
    logger.log(payload, label);
  };

  const logRecipe = (r: Recipe) => {
    log(
      {
        type: 'meal',
        occurred_at: toLocalISO(new Date()),
        precision: 'exact',
        mealName: r.name,
        ...(r.proteinG !== undefined ? { proteinG: r.proteinG } : {}),
        ...(r.calories !== undefined ? { calories: r.calories } : {}),
      },
      r.name,
    );
  };

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

  const openRow = (ev: AppEvent) => {
    if (ev.id.startsWith('ghost-')) return; // still syncing — one refresh away
    setEditing(ev);
  };

  const nowIso = toLocalISO(new Date());
  const displayEvents = [...events, ...ghosts].filter((e) => !pendingDeletes.has(e.id));

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Nutrition</h1>
      </header>

      <RecipeQuickLog recipes={recipes} onLog={logRecipe} />

      <button
        className={`${styles.gridBtn} btn-flash`}
        style={{ '--accent': 'var(--intake)' } as React.CSSProperties}
        onClick={() => setSheetOpen(true)}
      >
        <span className={styles.gridDot} aria-hidden />
        + Log meal
      </button>

      {loadError && <p className="error-inline">{loadError}</p>}

      <NutritionHistory
        events={displayEvents}
        nowIso={nowIso}
        hasMore={hasMore}
        loading={loading}
        onLoadMore={loadMore}
        onOpen={openRow}
        onDelete={requestDelete}
        pendingDeleteIds={pendingDeletes}
        onUndoDelete={undoDelete}
      />

      <LastLine last={logger.last} canUndo={logger.canUndo} onUndo={logger.undo} />
      {logger.error && (
        <p className="error-inline">
          {logger.error}
          <button onClick={logger.retry}>retry</button>
        </p>
      )}

      {sheetOpen && <MealSheet onLog={log} onClose={() => setSheetOpen(false)} />}
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
