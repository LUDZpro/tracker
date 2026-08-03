'use client';

import { useEffect, useMemo, useState } from 'react';
import { useReport } from '@/hooks/useReport';
import { buildReport, emptyReport } from '@/lib/report/build';
import { formatClock, formatSpan } from '@/lib/report/clockStats';
import { DAY_MODE_ANCHOR_HOUR, type DayMode } from '@/lib/report/days';
import { CAFFEINE_LATE_HOUR } from '@/lib/report/summary';
import { wallDateKey } from '@/lib/time';
import {
  Actogram,
  CountChart,
  dayLabel,
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

type DocTheme = 'dark' | 'light';

const THEME_KEY = 'report-theme';
const DAY_MODE_KEY = 'report-day-mode';

const DAY_MODE_COPY: Record<DayMode, { chip: string; blurb: string }> = {
  night: {
    chip: 'Night (noon → noon)',
    blurb:
      'A day runs noon to noon, so a night and the morning it ends in stay on one row and no sleep is ever cut in half. The row is named for the evening the night began — “Night of Sat 1 → 2 Aug” holds the sleep you started at 00:07 on the 2nd. This is the convention sleep clinics use.',
  },
  calendar: {
    chip: 'Calendar (midnight → midnight)',
    blurb:
      'A day runs midnight to midnight, so each row holds exactly the sleep that happened on that date — 2 Aug reads 16 h 27, all of it. The cost is that a sleep crossing midnight is split between two rows, and the halves show a 00:00 edge that is a cut rather than a real onset or wake.',
  },
};

/** Remembers the reader's day convention across visits. */
function useDayMode(): [DayMode, (next: DayMode) => void] {
  const [mode, setMode] = useState<DayMode>('night');

  useEffect(() => {
    const saved = window.localStorage.getItem(DAY_MODE_KEY);
    if (saved === 'night' || saved === 'calendar') setMode(saved);
  }, []);

  const choose = (next: DayMode) => {
    window.localStorage.setItem(DAY_MODE_KEY, next);
    setMode(next);
  };

  return [mode, choose];
}

/**
 * Dark matches the rest of the console and is the default. Light is the
 * green-and-white document skin for printing or handing the screen over;
 * printing forces it regardless of what is selected here.
 */
function useDocTheme(): [DocTheme, () => void] {
  const [theme, setTheme] = useState<DocTheme>('dark');

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem(THEME_KEY, next);
      return next;
    });
  };

  return [theme, toggle];
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden strokeLinecap="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 8V3h10v5" />
      <path d="M5 8h14a2 2 0 0 1 2 2v6h-4" />
      <path d="M3 16V10a2 2 0 0 1 2-2" />
      <path d="M7 14h10v7H7z" />
    </svg>
  );
}

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
  const [theme, toggleTheme] = useDocTheme();
  const [dayMode, setDayMode] = useDayMode();

  // Every month that carries data, for the filter chips.
  const months = useMemo(() => {
    if (!payload) return [];
    return [...new Set(payload.events.map((e) => wallDateKey(e.occurredAt).slice(0, 7)))].sort();
  }, [payload]);

  // Filtering re-derives every statistic from the filtered log, so the
  // summary always describes exactly what the charts below it show.
  const data = useMemo(() => {
    if (!payload) return emptyReport(dayMode);
    const events =
      month === ALL
        ? payload.events
        : payload.events.filter((e) => wallDateKey(e.occurredAt).startsWith(month));
    return buildReport(events, payload.now, dayMode);
  }, [payload, month, dayMode]);

  if (error) {
    return (
      <main className={styles.page} data-theme={theme}>
        <div className={styles.sheet}>
          <p className={styles.empty}>Could not load the record: {error}</p>
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className={styles.page} data-theme={theme}>
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
    <main className={styles.page} data-theme={theme}>
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
              {dayMode === 'night' ? 'Nights' : 'Days'} recorded: <b>{sleep.days}</b>
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
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={toggleTheme}
            aria-pressed={theme === 'light'}
            title={
              theme === 'dark'
                ? 'Switch to the light document skin'
                : 'Switch back to the console skin'
            }
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button type="button" className={styles.ghostBtn} onClick={() => window.print()}>
            <PrintIcon />
            Print / PDF
          </button>
        </div>

        <div className={styles.filter}>
          <span className={styles.filterLabel}>Day runs</span>
          {(['night', 'calendar'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.chip} ${dayMode === m ? styles.chipOn : ''}`}
              onClick={() => setDayMode(m)}
              aria-pressed={dayMode === m}
            >
              {DAY_MODE_COPY[m].chip}
            </button>
          ))}
        </div>

        <p className={styles.modeNote}>{DAY_MODE_COPY[dayMode].blurb}</p>

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
          Durations are given as the day&rsquo;s <b>total</b> time asleep, with the longest single
          episode shown beside it; shorter episodes on the same day are listed individually rather
          than collapsed into a count, and explicitly logged naps are counted separately.
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
              label={dayMode === 'night' ? 'Nights recorded' : 'Days recorded'}
              value={String(sleep.days)}
              sub={`${fragmentation.totalEpisodes} sleep episodes total`}
            />
            <Stat
              label="Avg total sleep"
              value={sleep.meanTotalMinutes ? formatSpan(sleep.meanTotalMinutes) : '—'}
              sub={
                sleep.shortestTotalMinutes !== null && sleep.longestTotalMinutes !== null
                  ? `range ${formatSpan(sleep.shortestTotalMinutes)} – ${formatSpan(sleep.longestTotalMinutes)}`
                  : undefined
              }
            />
            <Stat
              label="Avg longest episode"
              value={sleep.meanMainMinutes ? formatSpan(sleep.meanMainMinutes) : '—'}
              sub="the classic main-sleep figure"
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
                sleep.onsetDays > 0
                  ? `${sleep.lateOnsetDays} / ${sleep.onsetDays}`
                  : '—'
              }
              sub={
                sleep.onsetDays > 0
                  ? `${Math.round((sleep.lateOnsetDays / sleep.onsetDays) * 100)}% of recorded onsets`
                  : undefined
              }
            />
            <Stat
              label={dayMode === 'night' ? 'Nights split in two+' : 'Days split in two+'}
              value={String(fragmentation.fragmentedDays)}
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
          note={`One row per day, ${
            dayMode === 'night' ? 'noon to noon' : 'midnight to midnight'
          }. Blue is main sleep, orange a second episode in the same day; faded blocks are reconstructed. Grey rows are days with no tracking at all.`}
        >
          <Actogram
            rows={data.actogram}
            mode={dayMode}
            anchorHour={DAY_MODE_ANCHOR_HOUR[dayMode]}
          />
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
          title={`Total sleep per ${dayMode === 'night' ? 'night' : 'day'}`}
          note="Bar height is the whole day's sleep. The solid base is the longest episode; the lighter block above it is everything else logged that day. Dashed lines mark 7 h and 9 h; a bar whose total falls below 7 h turns orange."
        >
          <DurationChart days={data.days} mode={dayMode} />
          <div className={styles.legend}>
            <span>
              <i className={styles.swatch} style={{ background: 'var(--doc-sleep)' }} />
              Longest episode
            </span>
            <span>
              <i className={styles.swatch} style={{ background: 'var(--doc-sleep-soft)' }} />
              Additional episodes
            </span>
            <span>
              <i className={styles.swatch} style={{ background: 'var(--doc-frag)' }} />
              Total under 7 h
            </span>
          </div>
        </Card>

        <Card
          title={`Onset and wake per ${dayMode === 'night' ? 'night' : 'day'}`}
          note={`Axis runs noon to noon, so a 01:00 onset sits below a 23:00 one instead of jumping the chart. Each vertical line is that ${
            dayMode === 'night' ? 'night' : 'day'
          }'s longest episode.${
            dayMode === 'calendar'
              ? ' An end without a dot is a midnight cut rather than a real onset or wake.'
              : ''
          }`}
        >
          <OnsetWakeChart days={data.days} mode={dayMode} />
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
            <h2 className={styles.cardTitle}>
              {dayMode === 'night' ? 'Night-by-night detail' : 'Day-by-day detail'}
            </h2>
            <p className={styles.cardNote}>
              Every sleep episode, most recent first, grouped under the{' '}
              {dayMode === 'night' ? 'night' : 'day'} it belongs to. The longest episode of each is
              marked <b>main</b>.
            </p>
          </div>
          <div className={`${styles.cardBody} ${styles.scroll}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{dayMode === 'night' ? 'Night' : 'Day'}</th>
                  <th className={styles.num}>Total</th>
                  <th>Asleep</th>
                  <th>Awake</th>
                  <th className={styles.num}>Duration</th>
                  <th>Episode</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {[...data.days].reverse().map((d) =>
                  d.segments.map((s, i) => (
                    <tr
                      key={`${d.dayKey}-${s.startIso}-${i}`}
                      className={i === 0 ? styles.dayFirst : undefined}
                    >
                      {i === 0 && (
                        <>
                          <td rowSpan={d.segments.length}>{dayLabel(d.dayKey, dayMode)}</td>
                          <td className={`${styles.num} ${styles.total}`} rowSpan={d.segments.length}>
                            {formatSpan(d.totalMinutes)}
                          </td>
                        </>
                      )}
                      <td>
                        {s.clippedStart ? <span className={styles.cut}>…</span> : null}
                        {formatClock(s.startMinutes)}
                      </td>
                      <td>
                        {formatClock(s.endMinutes)}
                        {s.clippedEnd ? <span className={styles.cut}>…</span> : null}
                      </td>
                      <td className={styles.num}>{formatSpan(s.minutes)}</td>
                      <td>
                        {s === d.main ? (
                          <span className={styles.tag}>main</span>
                        ) : (
                          <span className={styles.dim}>extra</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`${styles.tag} ${
                            s.confidence === 'reconstructed' ? styles.tagRecon : ''
                          }`}
                        >
                          {s.confidence === 'reconstructed'
                            ? 'reconstructed'
                            : s.confidence === 'approximate'
                              ? 'approx.'
                              : 'logged'}
                        </span>
                      </td>
                    </tr>
                  )),
                )}
                {data.days.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className={styles.empty}>No sleep in this range.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {dayMode === 'calendar' ? (
            <p className={styles.cardNote}>
              A time marked <span className={styles.cut}>…</span> is where midnight cut a sleep that
              carried over — it is the edge of the day, not the moment you fell asleep or woke.
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
