'use client';

import { useMemo, useState } from 'react';
import { useReport } from '@/hooks/useReport';
import { buildReport, emptyReport } from '@/lib/report/build';
import { formatClock, formatSpan } from '@/lib/report/clockStats';
import { CAFFEINE_LATE_HOUR } from '@/lib/report/summary';
import { wallDateKey } from '@/lib/time';
import {
  Actogram,
  CountChart,
  DurationChart,
  OnsetWakeChart,
  RatingChart,
  TimeOfDayScatter,
} from './charts';
import styles from './report.module.css';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const ALL = 'all';

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

function longDate(key: string): string {
  if (!key) return '—';
  const [y, m, d] = key.split('-');
  return `${Number(d)} ${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

interface StatProps {
  label: string;
  value: string;
  sub?: string;
}

function Stat({ label, value, sub }: StatProps) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {sub ? <div className={styles.statSub}>{sub}</div> : null}
    </div>
  );
}

interface CardProps {
  title: string;
  note?: string;
  children: React.ReactNode;
}

function Card({ title, note, children }: CardProps) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {note ? <p className={styles.cardNote}>{note}</p> : null}
      </div>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

export default function ReportView() {
  const { report: payload, error } = useReport();
  const [month, setMonth] = useState<string>(ALL);

  // Every month that carries data, for the filter chips.
  const months = useMemo(() => {
    if (!payload) return [];
    return [...new Set(payload.events.map((e) => wallDateKey(e.occurredAt).slice(0, 7)))].sort();
  }, [payload]);

  // Filtering re-derives every statistic from the filtered log, so the
  // summary always describes exactly what the charts below it show.
  const data = useMemo(() => {
    if (!payload) return emptyReport();
    const events =
      month === ALL
        ? payload.events
        : payload.events.filter((e) => wallDateKey(e.occurredAt).startsWith(month));
    return buildReport(events, payload.now);
  }, [payload, month]);

  if (error) {
    return (
      <main className={styles.page}>
        <div className={styles.sheet}>
          <p className={styles.empty}>Could not load the record: {error}</p>
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className={styles.page}>
        <div className={styles.sheet}>
          <p className={styles.empty}>Loading the record…</p>
        </div>
      </main>
    );
  }

  const { meta, sleep, fragmentation, intake, confidence, regularity } = data;
  const scope = month === ALL ? 'Full record' : monthLabel(month);

  // Meals and caffeine started being logged months after sleep did. Plotting
  // them across the whole record leaves most of the chart empty and squeezes
  // the actual data into a corner, so each timing chart shares the x-axis of
  // the per-day chart above it rather than the full range.
  const mealDayKeys = data.mealsPerDay.map((d) => d.dayKey);
  const caffeineDayKeys = data.caffeinePerDay.map((d) => d.dayKey);

  return (
    <main className={styles.page}>
      <div className={styles.sheet}>
        <header className={styles.head}>
          <div>
            <div className={styles.kicker}>Self-tracking record</div>
            <h1 className={styles.title}>Sleep &amp; Behavioural Report</h1>
            <div className={styles.subtitle}>
              {longDate(meta.fromKey)} – {longDate(meta.toKey)} · Morocco (GMT+1) · {scope}
            </div>
          </div>
          <div className={styles.headStats}>
            <div>
              Nights recorded: <b>{sleep.nights}</b>
            </div>
            <div>
              Avg onset: <b>{sleep.onset ? formatClock(sleep.onset.meanMinutes) : '—'}</b>
            </div>
            <div>
              Avg wake: <b>{sleep.wake ? formatClock(sleep.wake.meanMinutes) : '—'}</b>
            </div>
          </div>
        </header>

        <div className={styles.filter}>
          <span className={styles.filterLabel}>Month</span>
          <button
            type="button"
            className={`${styles.chip} ${month === ALL ? styles.chipOn : ''}`}
            onClick={() => setMonth(ALL)}
          >
            All
          </button>
          {months.map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.chip} ${month === m ? styles.chipOn : ''}`}
              onClick={() => setMonth(m)}
            >
              {monthLabel(m)}
            </button>
          ))}
          <span className={styles.spacer} />
          <button type="button" className={styles.printBtn} onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>

        <div className={styles.method}>
          <b>How to read this.</b> Every entry is self-logged in a personal tracking app.
          {confidence.reconstructed > 0 ? (
            <>
              {' '}
              {confidence.reconstructed} of {data.episodes.length} sleep spans were{' '}
              <b>reconstructed from notes</b> after the fact rather than logged at the time — those
              are drawn faded throughout and carry roughly ±1 h of uncertainty.
            </>
          ) : null}{' '}
          Main sleep is the longest episode of each noon-to-noon day; shorter episodes on the same
          day are counted as fragments, and explicitly logged naps are counted separately.
          {meta.blocks.length > 1
            ? ` Tracking was interrupted — the record splits into ${meta.blocks.length} periods, shown as gaps rather than interpolated.`
            : ''}
          {meta.offsets.length > 1
            ? ' Timestamps carry two different UTC offsets from an earlier data migration; all times are read as local wall-clock, which is the reading the entries were made in.'
            : ''}
        </div>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Summary — {scope}</h2>
            <p className={styles.cardNote}>
              {meta.trackedDays} days with entries across a {meta.spanDays}-day span.
            </p>
          </div>
          <div className={styles.stats}>
            <Stat
              label="Nights recorded"
              value={String(sleep.nights)}
              sub={`${fragmentation.totalEpisodes} sleep episodes total`}
            />
            <Stat
              label="Avg main sleep"
              value={sleep.meanDurationMinutes ? formatSpan(sleep.meanDurationMinutes) : '—'}
              sub={
                sleep.shortestNightMinutes !== null && sleep.longestNightMinutes !== null
                  ? `range ${formatSpan(sleep.shortestNightMinutes)} – ${formatSpan(sleep.longestNightMinutes)}`
                  : undefined
              }
            />
            <Stat
              label="Avg onset"
              value={sleep.onset ? formatClock(sleep.onset.meanMinutes) : '—'}
              sub={sleep.onset ? `±${formatSpan(sleep.onset.sdMinutes)} spread` : undefined}
            />
            <Stat
              label="Avg wake"
              value={sleep.wake ? formatClock(sleep.wake.meanMinutes) : '—'}
              sub={sleep.wake ? `±${formatSpan(sleep.wake.sdMinutes)} spread` : undefined}
            />
            <Stat
              label="Onset after 03:00"
              value={
                sleep.nights > 0
                  ? `${sleep.lateOnsetNights} / ${sleep.nights}`
                  : '—'
              }
              sub={
                sleep.nights > 0
                  ? `${Math.round((sleep.lateOnsetNights / sleep.nights) * 100)}% of nights`
                  : undefined
              }
            />
            <Stat
              label="Nights split in two+"
              value={String(fragmentation.fragmentedNights)}
              sub={`${fragmentation.eveningEpisodes} evening sleeps`}
            />
            <Stat
              label="Naps logged"
              value={String(fragmentation.naps)}
              sub={
                fragmentation.meanNapMinutes
                  ? `avg ${formatSpan(fragmentation.meanNapMinutes)}`
                  : undefined
              }
            />
            <Stat
              label="Regularity index"
              value={regularity.sri === null ? '—' : regularity.sri.toFixed(0)}
              sub="−100 to 100; higher is steadier"
            />
            <Stat
              label="Meals logged"
              value={String(intake.meals)}
              sub={
                intake.meanMealsPerDay
                  ? `${intake.meanMealsPerDay.toFixed(1)}/day · ${intake.nightMeals} between 00:00–07:00`
                  : undefined
              }
            />
            <Stat
              label="Caffeine doses"
              value={String(intake.caffeineDoses)}
              sub={
                intake.caffeineDoses > 0
                  ? `${intake.caffeineLate} after ${CAFFEINE_LATE_HOUR}:00`
                  : undefined
              }
            />
          </div>
        </section>

        <Card
          title="Sleep actogram"
          note="One row per day, noon to noon. Blue is main sleep, orange a second episode in the same day; faded blocks are reconstructed. Grey rows are days with no tracking at all."
        >
          <Actogram rows={data.actogram} />
          <div className={styles.legend}>
            <span>
              <i className={styles.swatch} style={{ background: 'var(--doc-sleep)' }} />
              Main sleep
            </span>
            <span>
              <i className={styles.swatch} style={{ background: 'var(--doc-frag)' }} />
              Additional episode
            </span>
            <span>
              <i className={styles.swatch} style={{ background: 'var(--doc-void)' }} />
              Not tracked
            </span>
          </div>
        </Card>

        <Card
          title="Main sleep duration per night"
          note="Dashed lines mark 7 h and 9 h. Orange bars fall below 7 h."
        >
          <DurationChart nights={data.nights} />
        </Card>

        <Card
          title="Onset and wake per night"
          note="Axis runs noon to noon, so a 01:00 onset sits below a 23:00 one instead of jumping the chart. Each vertical line is one night."
        >
          <OnsetWakeChart nights={data.nights} />
          <div className={styles.legend}>
            <span>
              <i className={styles.swatch} style={{ background: 'var(--doc-sleep)' }} />
              Fell asleep
            </span>
            <span>
              <i className={styles.swatch} style={{ background: 'var(--doc-accent)' }} />
              Woke
            </span>
          </div>
        </Card>

        <Card
          title="Meals per day"
          note={
            data.mealTrackingFromKey
              ? `Meal logging began ${longDate(data.mealTrackingFromKey)}; only days from then on are counted. Grey columns are untracked days.`
              : 'No meals logged in this range.'
          }
        >
          <CountChart days={data.mealsPerDay} color="var(--doc-meal)" label="Meals" />
        </Card>

        <Card title="Meal timing" note="Every logged meal by clock time. The band below 07:00 is overnight eating.">
          <TimeOfDayScatter
            points={data.mealPoints}
            dayKeys={mealDayKeys}
            color="var(--doc-meal)"
            label="Meals"
            cutoffHour={7}
          />
        </Card>

        <Card title="Caffeine per day" note="Grey columns are untracked days.">
          <CountChart days={data.caffeinePerDay} color="var(--doc-caff)" label="Doses" />
        </Card>

        <Card
          title="Caffeine timing"
          note={`Dashed line marks ${CAFFEINE_LATE_HOUR}:00 — doses above it are late-day intake.`}
        >
          <TimeOfDayScatter
            points={data.caffeinePoints}
            dayKeys={caffeineDayKeys}
            color="var(--doc-caff)"
            label="Caffeine"
            cutoffHour={CAFFEINE_LATE_HOUR}
          />
        </Card>

        <Card title="Mood and energy self-ratings" note="Self-rated 1–5 at the moment of logging.">
          <RatingChart mood={data.mood} energy={data.energy} dayKeys={data.rangeKeys} />
          <div className={styles.legend}>
            <span>
              <i className={styles.swatch} style={{ background: 'var(--doc-accent)' }} />
              Mood
            </span>
            <span>
              <i className={styles.swatch} style={{ background: 'var(--doc-caff)' }} />
              Energy
            </span>
          </div>
        </Card>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Night-by-night detail</h2>
            <p className={styles.cardNote}>Main sleep of each day, most recent first.</p>
          </div>
          <div className={`${styles.cardBody} ${styles.scroll}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Asleep</th>
                  <th>Awake</th>
                  <th className={styles.num}>Duration</th>
                  <th className={styles.num}>Extra episodes</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {[...data.nights].reverse().map((n) => (
                  <tr key={n.dayKey}>
                    <td>{longDate(n.dayKey)}</td>
                    <td>{formatClock(n.onsetMinutes)}</td>
                    <td>{formatClock(n.wakeMinutes)}</td>
                    <td className={styles.num}>{formatSpan(n.durationMinutes)}</td>
                    <td className={styles.num}>{n.fragments || '—'}</td>
                    <td>
                      <span
                        className={`${styles.tag} ${
                          n.confidence === 'reconstructed' ? styles.tagRecon : ''
                        }`}
                      >
                        {n.confidence === 'reconstructed'
                          ? 'reconstructed'
                          : n.confidence === 'approximate'
                            ? 'approx.'
                            : 'logged'}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.nights.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className={styles.empty}>No nights in this range.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
