'use client';

import { useState } from 'react';
import { SLEEP_GOAL, coverage, hitCount } from '@/lib/goals';
import { formatDuration } from '@/lib/weekStats';
import { buildWeekCharts } from '@/lib/weekCharts';
import type { WeekResponse } from '@/lib/types';
import ChartAxis from '@/components/charts/ChartAxis';
import ChartFoot from '@/components/charts/ChartFoot';
import HourBar from '@/components/charts/HourBar';
import WeekOverview from '@/components/charts/WeekOverview';
import chart from '@/components/charts/charts.module.css';
import styles from './home.module.css';

interface Props {
  week: WeekResponse | null;
  todayKey: string;
  error: string | null;
}

/**
 * Mobile's week view. Before this the phone had goal cards and nothing else —
 * no way to see how the week was going without a desktop.
 *
 * The matrix leads because it is the only chart that answers the question
 * across every tracker in one glance and still fits a 28rem column. Sleep
 * expands underneath on demand rather than stacking four charts on a phone.
 */
export default function MobileWeek({ week, todayKey, error }: Props) {
  const [open, setOpen] = useState(false);

  if (!week) return null;

  const w = buildWeekCharts(week.events, todayKey);
  const sleepValues = w.sleep.map((p) => p.value);
  const sleepCov = coverage(sleepValues);
  const sleepHits = hitCount(SLEEP_GOAL, sleepValues);
  const logged = sleepValues.filter((v): v is number => v !== null);
  const avg =
    logged.length > 0
      ? formatDuration(logged.reduce((a, b) => a + b, 0) / logged.length)
      : '—';

  return (
    <section className={styles.section}>
      <span className={styles.eyebrow}>This week</span>
      <WeekOverview week={week} todayKey={todayKey} error={error} />

      <button
        type="button"
        className={styles.weekToggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? 'Hide sleep detail' : 'Show sleep detail'}
      </button>

      {open && (
        <div className={styles.weekDetail}>
          <div className={chart.key}>
            <span>Sleep</span>
            <b>goal 7–9h · avg {avg}</b>
          </div>
          <div className={chart.hourInset}>
            <HourBar
              points={w.sleep}
              scaleHours={10}
              goalHours={SLEEP_GOAL.min / 60}
              overHours={SLEEP_GOAL.max / 60}
              ticks={[0, 4, 8]}
            />
            <ChartAxis points={w.sleep} />
            <ChartFoot
              summary="In range"
              count={`${sleepHits.hits} of ${sleepHits.logged} logged nights`}
              coverage={sleepCov}
            />
          </div>
        </div>
      )}
    </section>
  );
}
