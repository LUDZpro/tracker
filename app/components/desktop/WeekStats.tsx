'use client';

import {
  CAFFEINE_COUNT_GOAL,
  PROTEIN_GOAL,
  SLEEP_GOAL,
  coverage,
  evaluate,
  hitCount,
  scaleFor,
} from '@/lib/goals';
import { formatDuration } from '@/lib/weekStats';
import { buildWeekCharts } from '@/lib/weekCharts';
import type { WeekResponse } from '@/lib/types';
import ChartAxis from '../charts/ChartAxis';
import ChartFoot from '../charts/ChartFoot';
import CutoffTrack from '../charts/CutoffTrack';
import HourBar from '../charts/HourBar';
import Spark from '../charts/Spark';
import chart from '../charts/charts.module.css';
import styles from './desktop.module.css';

interface Props {
  week: WeekResponse | null;
  todayKey: string;
  error: string | null;
}

/**
 * Right column: sleep, mood, caffeine and protein over the last 7 days.
 *
 * Every chart here now draws its goal, leaves a gap where a day was not
 * logged, and states the denominator behind its summary.
 */
export default function WeekStats({ week, todayKey, error }: Props) {
  if (!week) {
    return (
      <div className={styles.sec}>
        <span className={styles.eyebrow}>Last 7 days</span>
        <p className={styles.emptyHint}>{error ?? 'Loading…'}</p>
      </div>
    );
  }

  const w = buildWeekCharts(week.events, todayKey);

  const sleepValues = w.sleep.map((p) => p.value);
  const sleepCov = coverage(sleepValues);
  const sleepHits = hitCount(SLEEP_GOAL, sleepValues);
  const sleepLogged = sleepValues.filter((v): v is number => v !== null);
  const sleepAvg =
    sleepLogged.length > 0
      ? formatDuration(sleepLogged.reduce((a, b) => a + b, 0) / sleepLogged.length)
      : '—';

  const proteinValues = w.protein.map((p) => p.value);
  const proteinCov = coverage(proteinValues);
  const proteinHits = hitCount(PROTEIN_GOAL, proteinValues);
  const proteinScale = scaleFor(PROTEIN_GOAL, proteinValues);

  const moodValues = w.mood.map((p) => p.value);
  const moodCov = coverage(moodValues);
  const moodLogged = moodValues.filter((v): v is number => v !== null);
  const moodAvg =
    moodLogged.length > 0
      ? (moodLogged.reduce((a, b) => a + b, 0) / moodLogged.length).toFixed(1)
      : '—';

  const caffeineOver = w.caffeine.filter(
    (d) =>
      d.minutes.length > 0 &&
      (evaluate(CAFFEINE_COUNT_GOAL, d.minutes.length) !== 'goal' ||
        d.minutes.some((m) => m > 16 * 60)),
  ).length;

  return (
    <div className={styles.sec}>
      <span className={styles.eyebrow}>Last 7 days</span>

      <div className={styles.stat}>
        <div className={chart.key}>
          <span>Sleep</span>
          <b>goal 7–9h · avg {sleepAvg}</b>
        </div>
        <div className={chart.hourInset}>
          <HourBar
            points={w.sleep}
            scaleHours={10}
            goalHours={SLEEP_GOAL.min / 60}
            overHours={SLEEP_GOAL.max / 60}
          />
          <ChartAxis points={w.sleep} />
          <ChartFoot
            summary="In range"
            count={`${sleepHits.hits} of ${sleepHits.logged} logged nights`}
            coverage={sleepCov}
          />
        </div>
      </div>

      <div className={styles.stat}>
        <div className={chart.key}>
          <span>Protein</span>
          <b>floor {PROTEIN_GOAL.min} g</b>
        </div>
        <Spark
          points={w.protein}
          scaleMax={proteinScale}
          rule={{ value: PROTEIN_GOAL.min, label: `${PROTEIN_GOAL.min} g` }}
          capAbove={PROTEIN_GOAL.scaleMax}
          formatCap={(v) => `${v}`}
        />
        <ChartAxis points={w.protein} />
        <ChartFoot
          summary="Reached the floor"
          count={`${proteinHits.hits} of ${proteinHits.logged} logged days`}
          coverage={proteinCov}
        />
      </div>

      <div className={styles.stat}>
        <div className={chart.key}>
          <span>Caffeine</span>
          <b>
            cutoff 16:00 · max {CAFFEINE_COUNT_GOAL.max}/day
          </b>
        </div>
        <CutoffTrack days={w.caffeine} />
        <ChartFoot
          summary="Outside a caffeine goal on"
          count={`${caffeineOver} of 7 days`}
          coverage={{ logged: 7, total: 7, thin: false, insufficient: false }}
        />
      </div>

      <div className={styles.stat}>
        <div className={chart.key}>
          <span>Mood</span>
          <b>no goal set · avg {moodAvg}</b>
        </div>
        <div className={styles.mgrid} aria-hidden>
          {w.mood.map((p) => {
            const filled = p.value === null ? 0 : Math.round(p.value);
            return (
              <div key={p.key}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <i key={n} className={n <= filled ? styles.mgridF : ''} />
                ))}
              </div>
            );
          })}
        </div>
        <ChartAxis points={w.mood} />
        <ChartFoot summary="Logged on" count={`${moodCov.logged} of 7 days`} coverage={moodCov} />
      </div>
    </div>
  );
}
