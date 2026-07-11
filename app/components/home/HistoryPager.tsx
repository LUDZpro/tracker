'use client';

import { shiftDateKey, wallDateKey } from '@/lib/time';
import styles from './home.module.css';

interface Props {
  offset: number;
  axisDate: string;
  nowIso: string;
  canBack: boolean;
  onBack: () => void;
  onForward: () => void;
}

/** Pages the whole view (strip + list) back one wake-window at a time. */
export default function HistoryPager({
  offset,
  axisDate,
  nowIso,
  canBack,
  onBack,
  onForward,
}: Props) {
  const todayKey = wallDateKey(nowIso);
  const label =
    offset === 0
      ? 'today'
      : axisDate === shiftDateKey(todayKey, -1)
        ? 'yesterday'
        : axisDate;

  return (
    <nav className={styles.pager} aria-label="Wake-window history">
      <button className={styles.pagerBtn} onClick={onBack} disabled={!canBack}>
        ‹ {offset === 0 ? 'yesterday' : 'older'}
      </button>
      <span className={styles.pagerLabel}>{label}</span>
      {offset > 0 ? (
        <button className={styles.pagerBtn} onClick={onForward}>
          {offset === 1 ? 'today' : 'newer'} ›
        </button>
      ) : (
        <span className={styles.pagerSpacer} aria-hidden />
      )}
    </nav>
  );
}
