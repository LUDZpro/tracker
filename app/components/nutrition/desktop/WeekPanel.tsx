'use client';

import { PROTEIN_GOAL, coverage, evaluate, scaleFor } from '@/lib/goals';
import { dayLabel } from '@/lib/weekStats';
import type { NutritionStats } from '@/lib/nutrition/stats';
import ChartAxis from '@/components/charts/ChartAxis';
import ChartFoot from '@/components/charts/ChartFoot';
import Spark from '@/components/charts/Spark';
import type { ChartPoint } from '@/components/charts/types';
import styles from './nutrition-console.module.css';

interface Props {
  stats: NutritionStats | null; // null while the week is still loading
  proteinTarget: number;
}

export default function WeekPanel({ stats, proteinTarget }: Props) {
  const goal = { ...PROTEIN_GOAL, min: proteinTarget };
  const days = stats?.days ?? [];

  const points: ChartPoint[] = days.map((d) => {
    // An unlogged day is a gap, never a very bad day.
    const value = d.logged ? d.protein : null;
    const state = evaluate(goal, value);
    return {
      key: d.key,
      label: d.label,
      value,
      state,
      isToday: d.isToday,
      tip: {
        day: dayLabel(d.key),
        value: value === null ? 'Not logged' : `${value}g`,
        verdict:
          value === null
            ? 'No meals recorded'
            : state === 'goal'
              ? `Reached ${proteinTarget}g`
              : `${proteinTarget - value}g short of ${proteinTarget}g`,
      },
    };
  });

  const values = points.map((p) => p.value);
  const cov = coverage(values);
  const scale = scaleFor(goal, values);

  return (
    <div className={styles.col}>
      <span className={`${styles.sectionLabel} ${styles.panelGap}`} style={{ marginTop: 0 }}>
        Protein · 7 days
      </span>
      <div className={styles.panelCard}>
        {stats === null ? (
          <div className={styles.paceText}>Loading the week…</div>
        ) : (
          <>
            <Spark
              points={points}
              scaleMax={scale}
              rule={{ value: proteinTarget, label: `${proteinTarget} g` }}
              capAbove={Math.max(goal.scaleMax, proteinTarget + 40)}
              formatCap={(v) => `${v}`}
            />
            <ChartAxis points={points} />
            <ChartFoot
              summary="Reached the floor"
              count={`${stats.weekHits} of ${stats.daysLogged} logged days`}
              coverage={cov}
            />
            <div className={styles.chartFootRow}>
              <span>Average per logged day</span>
              <span>{`${stats.weekAvg}g`}</span>
            </div>
          </>
        )}
      </div>

      <span className={`${styles.sectionLabel} ${styles.panelGap}`}>This week</span>
      <div className={`${styles.panelCard} ${styles.panelCardRows}`}>
        <div className={styles.panelRow}>
          {/* Not "streak": the manual's goal-language table lists streak
              framing as the thing to avoid, since a gap should not erase
              the days that did go well. */}
          <span>Days at target</span>
          <span className={styles.panelVal}>
            {stats ? `${stats.weekHits} of ${stats.daysLogged}` : '—'}
          </span>
        </div>
        <div className={styles.panelRow}>
          <span>Avg per meal</span>
          <span className={styles.panelVal}>{stats ? `${stats.avgPerMeal}g` : '—'}</span>
        </div>
        <div className={styles.panelRow}>
          <span>Avg kcal / day</span>
          <span className={styles.panelVal}>{stats ? stats.avgKcal : '—'}</span>
        </div>
        <div className={styles.panelRow}>
          <span>Most logged</span>
          <span className={styles.panelVal}>{stats?.mostLogged ?? '—'}</span>
        </div>
      </div>

      <span className={`${styles.sectionLabel} ${styles.panelGap}`}>Pace</span>
      <div className={styles.panelCard}>
        <div className={styles.paceText}>{stats ? stats.paceMessage : 'Loading the week…'}</div>
      </div>
    </div>
  );
}
