'use client';

import { CbtIcon, DISTORTION_META } from './presentation';
import type { CbtDistortion, CbtRecord } from '@/lib/cbt/types';
import styles from './cbt.module.css';

interface Props {
  records: CbtRecord[];
}

const TOP_N = 3;

/** Patterns strip: proof the exercise works + which traps keep recurring. */
export default function CbtInsights({ records }: Props) {
  if (records.length === 0) return null;

  const totalDelta = records.reduce((s, r) => s + (r.intensityBefore - r.intensityAfter), 0);
  const avgRelief = Math.round(totalDelta / records.length);

  const counts = new Map<CbtDistortion, number>();
  for (const r of records) {
    for (const d of r.distortions) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP_N);
  const maxCount = top[0]?.[1] ?? 0;

  return (
    <section className={styles.insights} aria-label="Patterns">
      <div className={styles.insightStats}>
        <div className={styles.insightStat}>
          <b>{records.length}</b>
          <span>records</span>
        </div>
        <div className={styles.insightStat}>
          <b className={avgRelief > 0 ? styles.reliefPositive : undefined}>
            {avgRelief > 0 ? `−${avgRelief}` : avgRelief}
          </b>
          <span>avg relief (pts)</span>
        </div>
      </div>
      {top.length > 0 && (
        <div className={styles.insightBars}>
          <h3>Your most common traps</h3>
          {top.map(([d, n]) => (
            <div key={d} className={styles.insightBarRow}>
              <span className={styles.insightBarIcon}>
                <CbtIcon body={DISTORTION_META[d].icon} size={15} />
              </span>
              <span className={styles.insightBarLabel}>{DISTORTION_META[d].label}</span>
              <span className={styles.insightBarTrack}>
                <span
                  className={styles.insightBarFill}
                  style={{ width: `${(n / maxCount) * 100}%` }}
                />
              </span>
              <span className={styles.insightBarCount}>{n}×</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
