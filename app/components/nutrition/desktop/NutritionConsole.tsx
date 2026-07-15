'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DayLedger from './DayLedger';
import RecipeList from './RecipeList';
import WeekPanel from './WeekPanel';
import { clearLandedGhosts, ghostEvent } from '@/components/nutrition/ghost';
import { useHistory } from '@/hooks/useHistory';
import { useLogger } from '@/hooks/useLogger';
import { useRecipes } from '@/hooks/useRecipes';
import { useWeek } from '@/hooks/useWeek';
import { undoEvent } from '@/lib/client/api';
import { computeNutritionStats } from '@/lib/nutrition/stats';
import type { Recipe } from '@/lib/recipes/types';
import { toLocalISO, wallDateKey, wallHHMM } from '@/lib/time';
import type { AppEvent, EventPayload } from '@/lib/types';
import styles from './nutrition-console.module.css';

const DELETE_UNDO_MS = 5000;

function mealPayload(name: string, proteinG?: number, calories?: number): EventPayload {
  return {
    type: 'meal',
    occurred_at: toLocalISO(new Date()),
    precision: 'exact',
    mealName: name,
    ...(proteinG !== undefined ? { proteinG } : {}),
    ...(calories !== undefined ? { calories } : {}),
  };
}

/** Desktop nutrition console: recipes rail | day ledger | week numbers. The
 *  global Rail from the (ui) layout provides nav; this fills the rest. */
export default function NutritionConsole() {
  const { events, refresh: refreshHistory, error: historyError } = useHistory('meal');
  const { week, refresh: refreshWeek } = useWeek();
  const { recipes, proteinTarget, calorieTarget, error: recipesError } = useRecipes();

  const refreshAll = useCallback(() => {
    refreshHistory();
    refreshWeek();
  }, [refreshHistory, refreshWeek]);
  const logger = useLogger(refreshAll);

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

  // Today's rows (history first page + ghosts), wall-date filtered, ascending.
  const todayMeals = useMemo(() => {
    const todayKey = wallDateKey(toLocalISO(new Date()));
    return [...events, ...ghosts]
      .filter((e) => e.type === 'meal' && wallDateKey(e.occurredAt) === todayKey)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : 1));
  }, [events, ghosts]);

  // Totals ignore rows sitting in the 5s pending-delete window.
  const activeMeals = useMemo(
    () => todayMeals.filter((m) => !pendingDeletes.has(m.id)),
    [todayMeals, pendingDeletes],
  );
  const proteinTotal = activeMeals.reduce((a, m) => a + (m.proteinG ?? 0), 0);
  const kcalTotal = activeMeals.reduce((a, m) => a + (m.calories ?? 0), 0);
  const lastAt = activeMeals.length
    ? wallHHMM(activeMeals[activeMeals.length - 1].occurredAt)
    : null;

  const stats = useMemo(
    () => (week ? computeNutritionStats(week.events, week.now, proteinTarget) : null),
    [week, proteinTarget],
  );

  const log = useCallback(
    (payload: EventPayload, label: string) => {
      setGhosts((g) => [...g, ghostEvent(payload)]);
      logger.log(payload, label);
    },
    [logger],
  );

  const logRecipe = useCallback(
    (r: Recipe) => log(mealPayload(r.name, r.proteinG, r.calories), r.name),
    [log],
  );

  const quickAdd = useCallback(
    (name: string, proteinG: number | undefined, calories: number | undefined) =>
      log(mealPayload(name, proteinG, calories), name),
    [log],
  );

  const requestDelete = useCallback(
    (ev: AppEvent) => {
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

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const proteinPct = `${Math.min(100, Math.round((proteinTotal / proteinTarget) * 100))}%`;
  const kcalPct = `${Math.min(100, Math.round((kcalTotal / calorieTarget) * 100))}%`;
  const pSub =
    proteinTotal >= proteinTarget
      ? 'target reached'
      : `${proteinTarget - proteinTotal}g to target`;

  return (
    <main className={styles.main}>
      <div className={styles.topbar}>
        <div className={styles.topTitle}>
          <div className={styles.topKicker}>Nutrition</div>
          <div className={styles.topDate}>{todayLabel}</div>
        </div>
        <div className={styles.topSpacer} />
        <div className={styles.topMeter}>
          <div className={styles.meterHead}>
            <span>Protein</span>
            <span className={styles.meterVal}>
              {proteinTotal}g<span className={styles.meterDim}> / {proteinTarget}g</span>
            </span>
          </div>
          <div className={styles.track}>
            <i className={styles.fill} style={{ width: proteinPct }} />
          </div>
        </div>
        <div className={styles.topMeter}>
          <div className={styles.meterHead}>
            <span>Calories</span>
            <span className={styles.meterVal}>
              {kcalTotal}
              <span className={styles.meterDim}> / {calorieTarget}</span>
            </span>
          </div>
          <div className={styles.track}>
            <i className={`${styles.fill} ${styles.fillKcal}`} style={{ width: kcalPct }} />
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <RecipeList recipes={recipes} error={recipesError} onLog={logRecipe} />
        <DayLedger
          meals={todayMeals}
          pendingDeleteIds={pendingDeletes}
          proteinTotal={proteinTotal}
          kcalTotal={kcalTotal}
          mealCount={activeMeals.length}
          lastAt={lastAt}
          proteinTarget={proteinTarget}
          calorieTarget={calorieTarget}
          onDelete={requestDelete}
          onUndoDelete={undoDelete}
          onQuickAdd={quickAdd}
        />
        <WeekPanel stats={stats} proteinTarget={proteinTarget} />
      </div>

      <div className={styles.footer}>
        <span>
          {activeMeals.length} meal{activeMeals.length === 1 ? '' : 's'} today
        </span>
        <span className={styles.footDot}>·</span>
        <span>{pSub}</span>
        {historyError && (
          <>
            <span className={styles.footDot}>·</span>
            <span>{historyError}</span>
          </>
        )}
        <span className={styles.footHint}>
          recipes log at current time · edit times in the mobile view
        </span>
      </div>

      {logger.error ? (
        <div className={`${styles.toast} ${styles.toastError}`}>
          <span>{logger.error}</span>
          <button className={styles.toastBtn} onClick={logger.retry}>
            retry
          </button>
        </div>
      ) : (
        logger.last &&
        logger.canUndo && (
          <div className={styles.toast}>
            <span>Logged {logger.last.label}</span>
            <button className={styles.toastBtn} onClick={logger.undo}>
              Undo
            </button>
          </div>
        )
      )}
    </main>
  );
}
