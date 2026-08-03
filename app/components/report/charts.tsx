'use client';

/**
 * The report's SVG charts.
 *
 * Every clock axis is labelled at every hour rather than every three or four,
 * because the point of these charts is spotting *when* something happened and
 * a reader should never have to interpolate between gridlines. Every mark
 * carries a hover/focus tip with its exact date, time and value.
 */
import { actogramTicks, type ActogramRow } from '@/lib/report/actogram';
import { formatClock, formatSpan, nightAxisMinutes } from '@/lib/report/clockStats';
import { dayRowEndKey, type DayMode, type DayRow } from '@/lib/report/days';
import type { DayCount, RatingPoint, TimedPoint } from '@/lib/report/types';
import { ChartFrame, useTip } from './tip';
import styles from './report.module.css';

const DAY = 1440;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function shortDay(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

/** "Thu 30 Jul 2026" — tips always name the day in full, never just a number. */
function fullDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * A row's name in the active mode.
 *
 * In night mode this must say both dates. The row keyed 2026-08-01 holds
 * sleep that happened in the small hours of the 2nd, and labelling it "1 Aug"
 * alone is exactly what made the report look like it had invented a night.
 */
export function dayLabel(key: string, mode: DayMode): string {
  if (mode === 'calendar') return fullDay(key);

  const [y1, m1, d1] = key.split('-').map(Number);
  const [, m2, d2] = dayRowEndKey(key, mode).split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y1, m1 - 1, d1)).getUTCDay()];
  // Name both months only when the night crosses one, so the common case
  // stays short.
  const from = m1 === m2 ? `${d1}` : `${d1} ${MONTHS[m1 - 1]}`;
  return `Night of ${weekday} ${from} → ${d2} ${MONTHS[m2 - 1]} ${y1}`;
}

const CONFIDENCE_WORD: Record<string, string> = {
  logged: 'Logged live',
  approximate: 'Approximate',
  reconstructed: 'Reconstructed',
};

/** Hour ticks across a full day. `every` thins the *labels*, never the lines. */
function hourTicks(every = 1): number[] {
  const out: number[] = [];
  for (let h = 0; h <= 24; h += every) out.push(h);
  return out;
}

/* ---------------------------------------------------------------- actogram */

interface ActogramProps {
  rows: readonly ActogramRow[];
  mode: DayMode;
  /** Hour each row starts at — 12 in night mode, 0 in calendar mode. */
  anchorHour: number;
}

/** One row per day, sleep painted across it from the mode's anchor hour. */
export function Actogram({ rows, mode, anchorHour }: ActogramProps) {
  const { hostRef, tip, bind, hide } = useTip();
  if (rows.length === 0) return <p className={styles.empty}>No days in range.</p>;

  const rowH = rows.length > 60 ? 8 : rows.length > 30 ? 11 : 15;
  const gap = rowH > 10 ? 2 : 1;
  const labelW = 44;
  const width = 900;
  const plotW = width - labelW - 10;
  const height = rows.length * (rowH + gap) + 30;
  const x = (min: number) => labelW + (min / DAY) * plotW;
  const ticks = actogramTicks(1, anchorHour);
  /** Row-relative minutes back to a clock reading. */
  const clockAt = (min: number) => formatClock(min + anchorHour * 60);

  return (
    <ChartFrame hostRef={hostRef} tip={tip} onLeave={hide}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={
          mode === 'night'
            ? 'Sleep actogram, noon to noon, one row per night'
            : 'Sleep actogram, midnight to midnight, one row per calendar day'
        }
      >
        {ticks.map((t, i) => (
          <g key={t.atMinutes}>
            <line
              className={styles.gridLine}
              x1={x(t.atMinutes)}
              x2={x(t.atMinutes)}
              y1={18}
              y2={height - 10}
            />
            <text className={styles.axisText} x={x(t.atMinutes)} y={12} textAnchor="middle">
              {t.label}
            </text>
          </g>
        ))}

        {rows.map((row, i) => {
          const y = 22 + i * (rowH + gap);
          const showLabel = rows.length <= 40 || i % 7 === 0;
          const total = row.spans.reduce((a, s) => a + (s.to - s.from), 0);
          return (
            <g key={row.dayKey}>
              {showLabel && (
                <text className={styles.rowLabel} x={labelW - 7} y={y + rowH - 1} textAnchor="end">
                  {shortDay(row.dayKey)}
                </text>
              )}
              <rect
                x={labelW}
                y={y}
                width={plotW}
                height={rowH}
                fill={row.covered ? 'var(--doc-track)' : 'var(--doc-void)'}
                {...bind(
                  dayLabel(row.dayKey, mode),
                  row.covered
                    ? [
                        { k: 'Episodes', v: String(row.spans.length) },
                        { k: 'Time asleep', v: total > 0 ? formatSpan(total) : 'none' },
                      ]
                    : [{ k: 'Tracking', v: 'no entries' }],
                )}
              />
              {row.spans.map((s, j) => (
                <rect
                  key={j}
                  x={x(s.from)}
                  y={y}
                  width={Math.max(1, x(s.to) - x(s.from))}
                  height={rowH}
                  fill={s.kind === 'main' ? 'var(--doc-sleep)' : 'var(--doc-frag)'}
                  opacity={s.confidence === 'reconstructed' ? 0.45 : 1}
                  {...bind(dayLabel(row.dayKey, mode), [
                    { k: s.kind === 'main' ? 'Main sleep' : 'Extra episode', v: '' },
                    { k: 'Asleep', v: clockAt(s.from) },
                    { k: 'Awake', v: clockAt(s.to) },
                    { k: 'Duration', v: formatSpan(s.to - s.from) },
                    { k: 'Source', v: CONFIDENCE_WORD[s.confidence] },
                  ])}
                />
              ))}
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

/* ------------------------------------------------------- duration per night */

interface DayChartProps {
  days: readonly DayRow[];
  mode: DayMode;
}

/**
 * Total sleep per day, with the longest episode drawn as the base of each bar
 * and the rest of the day's sleep stacked above it.
 *
 * The bar used to show the longest episode alone, which on a fragmented day
 * hid most of the sleep: 2 Aug 2026 drew 6 h 37 against an actual 16 h 27.
 * Stacking keeps the main-sleep-period reading visible while making the bar's
 * height mean what a reader assumes it means.
 */
export function DurationChart({ days, mode }: DayChartProps) {
  const { hostRef, tip, bind, hide } = useTip();
  if (days.length === 0) return <p className={styles.empty}>No days in range.</p>;

  const width = 900;
  const height = 230;
  const padL = 30;
  const padB = 24;
  const plotW = width - padL - 10;
  const plotH = height - padB - 10;
  const maxH = Math.max(12, Math.ceil(Math.max(...days.map((d) => d.totalMinutes)) / 60) + 1);
  const barW = Math.max(2, plotW / days.length - 1.5);
  const y = (min: number) => 10 + plotH - (min / (maxH * 60)) * plotH;
  const labelEvery = Math.ceil(days.length / 14);

  return (
    <ChartFrame hostRef={hostRef} tip={tip} onLeave={hide}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="Total sleep per day in hours, split into main sleep and additional episodes"
      >
        {Array.from({ length: maxH + 1 }, (_, h) => h).map((h) => (
          <g key={h}>
            <line className={styles.gridLine} x1={padL} x2={width - 10} y1={y(h * 60)} y2={y(h * 60)} />
            {h % 2 === 0 && (
              <text className={styles.axisText} x={padL - 5} y={y(h * 60) + 3} textAnchor="end">
                {h}
              </text>
            )}
          </g>
        ))}
        <line className={styles.refLine} x1={padL} x2={width - 10} y1={y(420)} y2={y(420)} />
        <line className={styles.refLine} x1={padL} x2={width - 10} y1={y(540)} y2={y(540)} />

        {days.map((d, i) => {
          const bx = padL + (i * plotW) / days.length;
          const short = d.totalMinutes < 420;
          const extraMinutes = d.totalMinutes - d.main.minutes;
          const base = 10 + plotH;
          const mainTop = y(d.main.minutes);
          const totalTop = y(d.totalMinutes);
          const rows = [
            { k: 'Total asleep', v: formatSpan(d.totalMinutes) },
            { k: 'Longest episode', v: formatSpan(d.main.minutes) },
            { k: 'Episodes', v: String(d.segments.length) },
            {
              k: 'Vs 7h target',
              v: `${short ? '−' : '+'}${formatSpan(Math.abs(d.totalMinutes - 420))}`,
            },
            { k: 'Source', v: CONFIDENCE_WORD[d.main.confidence] },
          ];
          return (
            <g key={d.dayKey} opacity={d.main.confidence === 'reconstructed' ? 0.45 : 1}>
              {extraMinutes > 0 && (
                <rect
                  x={bx}
                  y={totalTop}
                  width={barW}
                  height={Math.max(1, mainTop - totalTop)}
                  rx={1}
                  fill="var(--doc-sleep-soft)"
                  {...bind(dayLabel(d.dayKey, mode), rows)}
                />
              )}
              <rect
                x={bx}
                y={mainTop}
                width={barW}
                height={Math.max(1, base - mainTop)}
                rx={1}
                fill={short ? 'var(--doc-frag)' : 'var(--doc-sleep)'}
                {...bind(dayLabel(d.dayKey, mode), rows)}
              />
            </g>
          );
        })}

        {days.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`l${d.dayKey}`}
              className={styles.axisText}
              x={padL + (i * plotW) / days.length + barW / 2}
              y={height - 7}
              textAnchor="middle"
            >
              {shortDay(d.dayKey)}
            </text>
          ) : null,
        )}
      </svg>
    </ChartFrame>
  );
}

/** Onset and wake clock times per day on a night-centred axis. */
export function OnsetWakeChart({ days, mode }: DayChartProps) {
  const { hostRef, tip, bind, hide } = useTip();
  if (days.length === 0) return <p className={styles.empty}>No days in range.</p>;

  const width = 900;
  const height = 500;
  const padL = 44;
  const padB = 24;
  const plotW = width - padL - 10;
  const plotH = height - padB - 12;
  // Axis runs 12:00 -> 12:00 so an onset at 01:00 sits below one at 23:00.
  const y = (min: number) => 12 + ((nightAxisMinutes(min) - 720) / DAY) * plotH;
  const labelEvery = Math.ceil(days.length / 14);

  return (
    <ChartFrame hostRef={hostRef} tip={tip} onLeave={hide}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="Sleep onset and wake time per night"
      >
        {hourTicks(1).map((h) => {
          const hour = 12 + h;
          const gy = 12 + ((hour * 60 - 720) / DAY) * plotH;
          return (
            <g key={h}>
              <line className={styles.gridLine} x1={padL} x2={width - 10} y1={gy} y2={gy} />
              <text className={styles.axisText} x={padL - 5} y={gy + 3} textAnchor="end">
                {formatClock(hour * 60)}
              </text>
            </g>
          );
        })}

        {days.map((d, i) => {
          const s = d.main;
          const x = padL + ((i + 0.5) * plotW) / days.length;
          const yOnset = y(s.startMinutes);
          const yWake = y(s.endMinutes);
          const dim = s.confidence === 'reconstructed' ? 0.45 : 1;
          const rows = [
            {
              k: 'Asleep',
              v: s.clippedStart ? `${formatClock(s.startMinutes)} (ran over from the day before)` : formatClock(s.startMinutes),
            },
            {
              k: 'Awake',
              v: s.clippedEnd ? `${formatClock(s.endMinutes)} (ran into the next day)` : formatClock(s.endMinutes),
            },
            { k: 'Longest episode', v: formatSpan(s.minutes) },
            { k: 'Total asleep', v: formatSpan(d.totalMinutes) },
            { k: 'Source', v: CONFIDENCE_WORD[s.confidence] },
          ];
          return (
            <g key={d.dayKey} opacity={dim}>
              <line
                x1={x}
                x2={x}
                y1={yOnset}
                y2={yWake}
                stroke="var(--doc-sleep-soft)"
                strokeWidth={3}
                {...bind(dayLabel(d.dayKey, mode), rows)}
              />
              {/* A midnight cut is not an onset, so it gets no marker. */}
              {!s.clippedStart && (
                <circle cx={x} cy={yOnset} r={2.8} fill="var(--doc-sleep)" {...bind(dayLabel(d.dayKey, mode), rows)} />
              )}
              {!s.clippedEnd && (
                <circle cx={x} cy={yWake} r={2.8} fill="var(--doc-mood)" {...bind(dayLabel(d.dayKey, mode), rows)} />
              )}
            </g>
          );
        })}

        {days.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`l${d.dayKey}`}
              className={styles.axisText}
              x={padL + ((i + 0.5) * plotW) / days.length}
              y={height - 7}
              textAnchor="middle"
            >
              {shortDay(d.dayKey)}
            </text>
          ) : null,
        )}
      </svg>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------ daily counts */

interface CountChartProps {
  days: readonly DayCount[];
  color: string;
  label: string;
}

/** Per-day counts (meals, caffeine). Uncovered days are drawn as voids. */
export function CountChart({ days, color, label }: CountChartProps) {
  const { hostRef, tip, bind, hide } = useTip();
  if (days.length === 0) return <p className={styles.empty}>Nothing logged in range.</p>;

  const width = 900;
  const height = 180;
  const padL = 26;
  const padB = 24;
  const plotW = width - padL - 10;
  const plotH = height - padB - 10;
  const max = Math.max(3, ...days.map((d) => d.count));
  const barW = Math.max(2, plotW / days.length - 1.5);
  const y = (v: number) => 10 + plotH - (v / max) * plotH;
  const noun = label.toLowerCase();
  const labelEvery = Math.ceil(days.length / 14);

  return (
    <ChartFrame hostRef={hostRef} tip={tip} onLeave={hide}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={`${label} per day`}
      >
        {Array.from({ length: max + 1 }, (_, v) => v).map((v) => (
          <g key={v}>
            <line className={styles.gridLine} x1={padL} x2={width - 10} y1={y(v)} y2={y(v)} />
            <text className={styles.axisText} x={padL - 5} y={y(v) + 3} textAnchor="end">
              {v}
            </text>
          </g>
        ))}

        {days.map((d, i) => {
          const x = padL + (i * plotW) / days.length;
          if (!d.covered) {
            return (
              <rect
                key={d.dayKey}
                x={x}
                y={10}
                width={barW}
                height={plotH}
                fill="var(--doc-void)"
                {...bind(fullDay(d.dayKey), [{ k: 'Tracking', v: 'no entries' }])}
              />
            );
          }
          return (
            <rect
              key={d.dayKey}
              x={x}
              y={y(d.count)}
              width={barW}
              height={Math.max(d.count === 0 ? 0 : 1, 10 + plotH - y(d.count))}
              rx={1}
              fill={color}
              {...bind(fullDay(d.dayKey), [{ k: label, v: `${d.count} ${noun}` }])}
            />
          );
        })}

        {days.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`l${d.dayKey}`}
              className={styles.axisText}
              x={padL + (i * plotW) / days.length + barW / 2}
              y={height - 7}
              textAnchor="middle"
            >
              {shortDay(d.dayKey)}
            </text>
          ) : null,
        )}
      </svg>
    </ChartFrame>
  );
}

/* --------------------------------------------------------- time-of-day dots */

interface ScatterProps {
  points: readonly TimedPoint[];
  dayKeys: readonly string[];
  color: string;
  label: string;
  /** Optional clock hour to draw as a reference line. */
  cutoffHour?: number;
}

/** Every event of one type placed by day (x) and clock time (y). */
export function TimeOfDayScatter({ points, dayKeys, color, label, cutoffHour }: ScatterProps) {
  const { hostRef, tip, bind, hide } = useTip();
  if (points.length === 0) return <p className={styles.empty}>Nothing logged in range.</p>;

  const width = 900;
  const height = 500;
  const padL = 44;
  const padB = 24;
  const plotW = width - padL - 10;
  const plotH = height - padB - 12;
  const index = new Map(dayKeys.map((k, i) => [k, i]));
  const y = (min: number) => 12 + (min / DAY) * plotH;
  // A point off this axis is dropped, not clamped: the old `?? 0` fallback
  // silently drew it on the first column, months from where it belonged.
  const x = (key: string) => {
    const i = index.get(key);
    return i === undefined ? null : padL + ((i + 0.5) * plotW) / Math.max(1, dayKeys.length);
  };
  const labelEvery = Math.ceil(dayKeys.length / 14);

  return (
    <ChartFrame hostRef={hostRef} tip={tip} onLeave={hide}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={`${label} timing by day`}
      >
        {hourTicks(1).map((h) => (
          <g key={h}>
            <line className={styles.gridLine} x1={padL} x2={width - 10} y1={y(h * 60)} y2={y(h * 60)} />
            <text className={styles.axisText} x={padL - 5} y={y(h * 60) + 3} textAnchor="end">
              {formatClock(h === 24 ? 0 : h * 60)}
            </text>
          </g>
        ))}
        {cutoffHour !== undefined && (
          <line
            className={styles.refLine}
            x1={padL}
            x2={width - 10}
            y1={y(cutoffHour * 60)}
            y2={y(cutoffHour * 60)}
          />
        )}

        {points.map((p, i) => {
          const cx = x(p.dayKey);
          if (cx === null) return null;
          return (
            <circle
              key={`${p.atIso}-${i}`}
              cx={cx}
              cy={y(p.minutes)}
              r={3.2}
              fill={color}
              {...bind(fullDay(p.dayKey), [
                { k: 'Time', v: formatClock(p.minutes) },
                { k: label, v: p.label || '—' },
              ])}
            />
          );
        })}

        {dayKeys.map((k, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`l${k}`}
              className={styles.axisText}
              x={padL + ((i + 0.5) * plotW) / Math.max(1, dayKeys.length)}
              y={height - 7}
              textAnchor="middle"
            >
              {shortDay(k)}
            </text>
          ) : null,
        )}
      </svg>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------- 1-5 ratings */

interface RatingChartProps {
  mood: readonly RatingPoint[];
  energy: readonly RatingPoint[];
  dayKeys: readonly string[];
}

/** Mood and energy self-ratings over the range. */
export function RatingChart({ mood, energy, dayKeys }: RatingChartProps) {
  const { hostRef, tip, bind, hide } = useTip();
  if (mood.length === 0 && energy.length === 0) {
    return <p className={styles.empty}>No self-ratings in range.</p>;
  }

  const width = 900;
  const height = 190;
  const padL = 26;
  const padB = 24;
  const plotW = width - padL - 10;
  const plotH = height - padB - 10;
  const index = new Map(dayKeys.map((k, i) => [k, i]));
  const y = (v: number) => 10 + plotH - ((v - 1) / 4) * plotH;
  // Dropped rather than clamped — see TimeOfDayScatter.
  const x = (key: string) => {
    const i = index.get(key);
    return i === undefined ? null : padL + ((i + 0.5) * plotW) / Math.max(1, dayKeys.length);
  };
  const labelEvery = Math.ceil(dayKeys.length / 14);

  const series = [
    { points: mood, color: 'var(--doc-mood)', name: 'Mood' },
    { points: energy, color: 'var(--doc-energy)', name: 'Energy' },
  ];

  return (
    <ChartFrame hostRef={hostRef} tip={tip} onLeave={hide}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="Mood and energy self-ratings, 1 to 5"
      >
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line className={styles.gridLine} x1={padL} x2={width - 10} y1={y(v)} y2={y(v)} />
            <text className={styles.axisText} x={padL - 5} y={y(v) + 3} textAnchor="end">
              {v}
            </text>
          </g>
        ))}

        {series.map((s, si) => (
          <g key={si}>
            {s.points.map((p, i) => {
              const cx = x(p.dayKey);
              if (cx === null) return null;
              return (
                <circle
                  key={`${si}-${i}`}
                  cx={cx}
                  cy={y(p.value)}
                  r={3.2}
                  fill={s.color}
                  {...bind(fullDay(p.dayKey), [
                    { k: s.name, v: `${p.value} / 5` },
                    { k: 'Time', v: formatClock(p.minutes) },
                  ])}
                />
              );
            })}
          </g>
        ))}

        {dayKeys.map((k, i) =>
          i % labelEvery === 0 ? (
            <text
              key={`l${k}`}
              className={styles.axisText}
              x={padL + ((i + 0.5) * plotW) / Math.max(1, dayKeys.length)}
              y={height - 7}
              textAnchor="middle"
            >
              {shortDay(k)}
            </text>
          ) : null,
        )}
      </svg>
    </ChartFrame>
  );
}
