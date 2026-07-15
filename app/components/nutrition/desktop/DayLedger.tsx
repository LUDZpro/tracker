'use client';

import { useState } from 'react';
import { Icon } from '@/components/desktop/presentation';
import { wallHHMM } from '@/lib/time';
import type { AppEvent } from '@/lib/types';
import styles from './nutrition-console.module.css';

interface Props {
  meals: AppEvent[]; // today's rows, ascending, pending-delete rows included
  pendingDeleteIds: ReadonlySet<string>;
  proteinTotal: number;
  kcalTotal: number;
  mealCount: number;
  lastAt: string | null; // HH:MM of the latest meal
  proteinTarget: number;
  calorieTarget: number;
  onDelete: (ev: AppEvent) => void;
  onUndoDelete: (id: string) => void;
  onQuickAdd: (name: string, proteinG: number | undefined, calories: number | undefined) => void;
}

function pct(value: number, target: number): string {
  if (target <= 0) return '0%';
  return `${Math.min(100, Math.round((value / target) * 100))}%`;
}

function parseMacro(raw: string): number | undefined {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default function DayLedger({
  meals,
  pendingDeleteIds,
  proteinTotal,
  kcalTotal,
  mealCount,
  lastAt,
  proteinTarget,
  calorieTarget,
  onDelete,
  onUndoDelete,
  onQuickAdd,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [qaName, setQaName] = useState('');
  const [qaProtein, setQaProtein] = useState('');
  const [qaKcal, setQaKcal] = useState('');

  const proteinDone = proteinTotal >= proteinTarget;
  const proteinLeft = Math.max(0, proteinTarget - proteinTotal);
  const kcalLeft = Math.max(0, calorieTarget - kcalTotal);
  const pSub = proteinDone ? 'target reached' : `${proteinLeft}g to target`;

  const submitQuickAdd = () => {
    const name = qaName.trim();
    if (!name) return;
    onQuickAdd(name, parseMacro(qaProtein), parseMacro(qaKcal));
    setQaName('');
    setQaProtein('');
    setQaKcal('');
  };

  return (
    <div className={`${styles.col} ${styles.colMid}`}>
      <span className={styles.sectionLabel} style={{ display: 'block', marginBottom: 11 }}>
        Today
      </span>
      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statBadge} ${proteinDone ? styles.statBadgeDone : ''}`}>
            {proteinDone && (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div className={styles.statLabel}>Protein</div>
          <div className={styles.statValue}>
            {proteinTotal}
            <small className={styles.statUnit}>g</small>
          </div>
          <div className={styles.statSub}>{pSub}</div>
          <div className={styles.statTrack}>
            <i className={styles.statFill} style={{ width: pct(proteinTotal, proteinTarget) }} />
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Calories</div>
          <div className={styles.statValue}>
            {kcalTotal}
            <small className={styles.statUnit}>kcal</small>
          </div>
          <div className={styles.statSub}>
            {kcalLeft > 0 ? `${kcalLeft} remaining` : 'target reached'}
          </div>
          <div className={styles.statTrack}>
            <i className={styles.statFill} style={{ width: pct(kcalTotal, calorieTarget) }} />
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel}>Meals</div>
          <div className={styles.statValue}>{mealCount}</div>
          <div className={styles.statSub}>{lastAt ? `last at ${lastAt}` : 'nothing yet'}</div>
        </div>
      </div>

      <div className={styles.sectionHead}>
        <span className={styles.sectionLabel}>Log</span>
        <span className={styles.sectionHint}>click a row for actions</span>
      </div>

      <div className={styles.quickAdd}>
        <input
          className={styles.qaName}
          value={qaName}
          onChange={(e) => setQaName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitQuickAdd();
          }}
          placeholder="Log a custom meal…"
        />
        <input
          className={styles.qaNum}
          value={qaProtein}
          onChange={(e) => setQaProtein(e.target.value)}
          inputMode="numeric"
          placeholder="g protein"
        />
        <input
          className={`${styles.qaNum} ${styles.qaNumSmall}`}
          value={qaKcal}
          onChange={(e) => setQaKcal(e.target.value)}
          inputMode="numeric"
          placeholder="kcal"
        />
        <button className={styles.qaBtn} onClick={submitQuickAdd} disabled={!qaName.trim()}>
          Add
        </button>
      </div>

      {meals.map((m) => {
        const pending = pendingDeleteIds.has(m.id);
        const ghost = m.id.startsWith('ghost-');
        const isSelected = selected === m.id;
        const rowClass = [
          styles.logRow,
          isSelected ? styles.logRowSelected : '',
          pending ? styles.logRowPending : '',
          ghost ? styles.logRowGhost : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <div
            key={m.id}
            className={rowClass}
            onClick={() => {
              if (pending || ghost) return;
              setSelected(isSelected ? null : m.id);
            }}
          >
            <span className={styles.logTime}>{wallHHMM(m.occurredAt)}</span>
            <span className={styles.logIcon}>
              <Icon name="meal" size={12} />
            </span>
            <span className={styles.logName}>{m.mealName ?? 'Meal'}</span>
            {pending ? (
              <button
                className={styles.undoBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onUndoDelete(m.id);
                }}
              >
                deleted · undo
              </button>
            ) : isSelected ? (
              <button
                className={styles.deleteBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(null);
                  onDelete(m);
                }}
              >
                delete
              </button>
            ) : (
              <>
                <span className={styles.logMeta}>
                  {m.proteinG !== undefined ? `${m.proteinG}g protein` : '—'}
                </span>
                <span className={`${styles.logMeta} ${styles.logMetaDim}`}>
                  {m.calories !== undefined ? `${m.calories} kcal` : ''}
                </span>
              </>
            )}
          </div>
        );
      })}

      {meals.length === 0 && (
        <div className={styles.emptyLog}>Nothing logged yet — tap a recipe on the left</div>
      )}

      <div className={styles.logTotals}>
        <span>
          Total <b>{proteinTotal}g protein</b>
        </span>
        <span>
          <b className={styles.totKcal}>{kcalTotal} kcal</b>
        </span>
      </div>
    </div>
  );
}
