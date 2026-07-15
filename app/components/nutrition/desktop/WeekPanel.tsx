'use client';

import type { NutritionStats } from '@/lib/nutrition/stats';
import styles from './nutrition-console.module.css';

interface Props {
  stats: NutritionStats | null; // null while the week is still loading
  proteinTarget: number;
}

export default function WeekPanel({ stats, proteinTarget }: Props) {
  // Bars scale against a ceiling slightly above target so a hit day reads tall
  // without maxing the chart.
  const ceiling = Math.max(170, proteinTarget + 20);

  return (
    <div className={styles.col}>
      <span className={`${styles.sectionLabel} ${styles.panelGap}`} style={{ marginTop: 0 }}>
        Protein · 7 days
      </span>
      <div className={styles.panelCard}>
        <div className={styles.bars}>
          {(stats?.days ?? Array.from({ length: 7 }, () => null)).map((d, i) =>
            d === null ? (
              <i key={i} className={styles.bar} style={{ height: '8%' }} />
            ) : (
              <i
                key={d.key}
                className={`${styles.bar} ${d.isToday ? styles.barToday : d.hit ? styles.barHit : ''}`}
                style={{
                  height: `${Math.max(8, Math.round((d.protein / ceiling) * 100))}%`,
                }}
                title={`${d.key}: ${d.protein}g`}
              />
            ),
          )}
        </div>
        <div className={styles.barLabels}>
          {(stats?.days ?? []).map((d) => (
            <span key={d.key} className={styles.barLabel}>
              {d.label}
            </span>
          ))}
        </div>
        <div className={styles.chartFoot}>
          <span>7-day average</span>
          <span>{stats ? `${stats.weekAvg}g` : '—'}</span>
        </div>
        <div className={styles.chartFootRow}>
          <span>Target hit</span>
          <span>{stats ? `${stats.weekHits} of 7 days` : '—'}</span>
        </div>
      </div>

      <span className={`${styles.sectionLabel} ${styles.panelGap}`}>This week</span>
      <div className={`${styles.panelCard} ${styles.panelCardRows}`}>
        <div className={styles.panelRow}>
          <span>Streak at target</span>
          <span className={styles.panelVal}>{stats ? `${stats.streak} days` : '—'}</span>
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
