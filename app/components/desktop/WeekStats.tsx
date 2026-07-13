'use client';

import {
  CAFFEINE_CUTOFF_MIN,
  PROTEIN_TARGET_G,
  caffeineByDay,
  dayLetter,
  formatHhMm,
  intensityAvgByDay,
  lastNDayKeys,
  proteinByDay,
  sleepMinutesByDay,
} from '@/lib/weekStats';
import type { WeekResponse } from '@/lib/types';
import styles from './desktop.module.css';

const DAYS = 7;
const SLEEP_SCALE_MIN = 9 * 60; // a 9h night fills the spark
const SLEEP_LOW_MIN = 6 * 60;
const SLEEP_ON_MIN = 7 * 60;

function SparkLabels({ dayKeys }: { dayKeys: string[] }) {
  return (
    <div className={styles.sparkx} aria-hidden>
      {dayKeys.map((k) => (
        <span key={k}>{dayLetter(k)}</span>
      ))}
    </div>
  );
}

interface SparkProps {
  dayKeys: string[];
  values: (number | null)[];
  scaleMax: number;
  lowBelow: number;
  onAtOrAbove: number;
}

function Spark({ dayKeys, values, scaleMax, lowBelow, onAtOrAbove }: SparkProps) {
  return (
    <div className={styles.spark}>
      {values.map((v, i) => {
        const isToday = i === values.length - 1;
        const h = v === null ? 4 : Math.max(6, Math.min(100, (v / scaleMax) * 100));
        const cls = isToday
          ? styles.sparkToday
          : v === null || v < lowBelow
            ? styles.sparkLow
            : v >= onAtOrAbove
              ? styles.sparkOn
              : '';
        return <i key={dayKeys[i]} className={cls} style={{ height: `${h}%` }} />;
      })}
    </div>
  );
}

interface Props {
  week: WeekResponse | null;
  todayKey: string;
  error: string | null;
}

/** Right column: sleep, mood, caffeine, and protein over the last 7 days. */
export default function WeekStats({ week, todayKey, error }: Props) {
  const dayKeys = lastNDayKeys(todayKey, DAYS);

  if (!week) {
    return (
      <div className={styles.sec}>
        <span className={styles.eyebrow}>Last 7 days</span>
        <p className={styles.emptyHint}>{error ?? 'Loading…'}</p>
      </div>
    );
  }

  const sleep = sleepMinutesByDay(week.events, dayKeys);
  const sleepLogged = sleep.filter((v): v is number => v !== null);
  const sleepAvg =
    sleepLogged.length > 0
      ? formatHhMm(sleepLogged.reduce((a, b) => a + b, 0) / sleepLogged.length)
      : '—';

  const mood = intensityAvgByDay(week.events, dayKeys, 'mood');
  const moodLogged = mood.filter((v): v is number => v !== null);
  const moodAvg =
    moodLogged.length > 0
      ? (moodLogged.reduce((a, b) => a + b, 0) / moodLogged.length).toFixed(1)
      : '—';

  const caffeine = caffeineByDay(week.events, dayKeys);
  const protein = proteinByDay(week.events, dayKeys);

  return (
    <div className={styles.sec}>
      <span className={styles.eyebrow}>Last 7 days</span>

      <div className={styles.stat}>
        <div className={styles.statK}>
          <span>Sleep</span>
          <b>avg {sleepAvg}</b>
        </div>
        <Spark
          dayKeys={dayKeys}
          values={sleep}
          scaleMax={SLEEP_SCALE_MIN}
          lowBelow={SLEEP_LOW_MIN}
          onAtOrAbove={SLEEP_ON_MIN}
        />
        <SparkLabels dayKeys={dayKeys} />
      </div>

      <div className={styles.stat}>
        <div className={styles.statK}>
          <span>Mood</span>
          <b>avg {moodAvg}</b>
        </div>
        <div className={styles.mgrid}>
          {mood.map((v, i) => {
            const filled = v === null ? 0 : Math.round(v);
            return (
              <div key={dayKeys[i]}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <i key={n} className={n <= filled ? styles.mgridF : ''} />
                ))}
              </div>
            );
          })}
        </div>
        <SparkLabels dayKeys={dayKeys} />
      </div>

      <div className={styles.stat}>
        <div className={styles.statK}>
          <span>Caffeine</span>
          <b>accent dot = after 16:00</b>
        </div>
        {caffeine.map((day, i) => (
          <div key={dayKeys[i]} className={styles.crow}>
            <span className={styles.crowD}>
              {new Date(`${dayKeys[i]}T12:00:00`).toLocaleDateString('en-US', {
                weekday: 'short',
              })}
            </span>
            <span className={styles.dots}>
              {day.minutes.map((m, j) => (
                <i key={j} className={m >= CAFFEINE_CUTOFF_MIN ? styles.dotLate : ''} />
              ))}
            </span>
            <span className={styles.lastt}>{day.last ?? '—'}</span>
          </div>
        ))}
      </div>

      <div className={styles.stat}>
        <div className={styles.statK}>
          <span>Protein</span>
          <b>target {PROTEIN_TARGET_G} g</b>
        </div>
        <Spark
          dayKeys={dayKeys}
          values={protein.map((g) => (g > 0 ? g : null))}
          scaleMax={PROTEIN_TARGET_G}
          lowBelow={PROTEIN_TARGET_G / 2}
          onAtOrAbove={PROTEIN_TARGET_G}
        />
        <SparkLabels dayKeys={dayKeys} />
      </div>
    </div>
  );
}
