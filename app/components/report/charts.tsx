'use client';

/**
 * The report's SVG charts.
 *
 * All of them are plain scaled SVG with no interaction: the page is meant to
 * be read on screen, printed, and handed over. Anything that only works with
 * a cursor would be lost on paper.
 */
import { actogramTicks, type ActogramRow } from '@/lib/report/actogram';
import { formatClock, formatSpan, nightAxisMinutes } from '@/lib/report/clockStats';
import type { NightRow } from '@/lib/report/build';
import type { DayCount, RatingPoint, TimedPoint } from '@/lib/report/types';
import styles from './report.module.css';

const DAY = 1440;

function shortDay(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

/* ---------------------------------------------------------------- actogram */

interface ActogramProps {
  rows: readonly ActogramRow[];
}

/** Noon-to-noon actogram: one row per day, sleep painted across the night. */
export function Actogram({ rows }: ActogramProps) {
  if (rows.length === 0) return <p className={styles.empty}>No days in range.</p>;

  const rowH = rows.length > 60 ? 7 : rows.length > 30 ? 10 : 14;
  const gap = rowH > 10 ? 2 : 1;
  const labelW = 42;
  const width = 900;
  const plotW = width - labelW - 8;
  const height = rows.length * (rowH + gap) + 26;
  const x = (min: number) => labelW + (min / DAY) * plotW;

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Sleep actogram, noon to noon, one row per day"
    >
      {actogramTicks().map((t) => (
        <g key={t.atMinutes}>
          <line
            className={styles.gridLine}
            x1={x(t.atMinutes)}
            x2={x(t.atMinutes)}
            y1={16}
            y2={height - 10}
          />
          <text className={styles.axisText} x={x(t.atMinutes)} y={11} textAnchor="middle">
            {t.label}
          </text>
        </g>
      ))}

      {rows.map((row, i) => {
        const y = 20 + i * (rowH + gap);
        const showLabel = rows.length <= 40 || i % 7 === 0;
        return (
          <g key={row.dayKey}>
            {showLabel && (
              <text className={styles.rowLabel} x={labelW - 6} y={y + rowH - 1} textAnchor="end">
                {shortDay(row.dayKey)}
              </text>
            )}
            <rect
              x={labelW}
              y={y}
              width={plotW}
              height={rowH}
              fill={row.covered ? '#f6f8fa' : 'var(--doc-void)'}
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
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------- duration per night */

interface NightChartProps {
  nights: readonly NightRow[];
}

/** Main-sleep duration per night, with 7h and 9h reference lines. */
export function DurationChart({ nights }: NightChartProps) {
  if (nights.length === 0) return <p className={styles.empty}>No nights in range.</p>;

  const width = 900;
  const height = 190;
  const padL = 30;
  const padB = 22;
  const plotW = width - padL - 8;
  const plotH = height - padB - 10;
  const maxH = Math.max(12, Math.ceil(Math.max(...nights.map((n) => n.durationMinutes)) / 60) + 1);
  const barW = Math.max(2, plotW / nights.length - 1.5);
  const y = (min: number) => 10 + plotH - (min / (maxH * 60)) * plotH;

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Main sleep duration per night in hours"
    >
      {[0, 2, 4, 6, 8, 10, 12].filter((h) => h <= maxH).map((h) => (
        <g key={h}>
          <line className={styles.gridLine} x1={padL} x2={width - 8} y1={y(h * 60)} y2={y(h * 60)} />
          <text className={styles.axisText} x={padL - 5} y={y(h * 60) + 3} textAnchor="end">
            {h}
          </text>
        </g>
      ))}
      <line className={styles.refLine} x1={padL} x2={width - 8} y1={y(420)} y2={y(420)} />
      <line className={styles.refLine} x1={padL} x2={width - 8} y1={y(540)} y2={y(540)} />

      {nights.map((n, i) => {
        const x = padL + (i * plotW) / nights.length;
        const top = y(n.durationMinutes);
        const short = n.durationMinutes < 420;
        return (
          <rect
            key={n.dayKey}
            x={x}
            y={top}
            width={barW}
            height={Math.max(1, 10 + plotH - top)}
            rx={1}
            fill={short ? 'var(--doc-frag)' : 'var(--doc-sleep)'}
            opacity={n.confidence === 'reconstructed' ? 0.45 : 1}
          >
            <title>{`${n.dayKey} — ${formatSpan(n.durationMinutes)}`}</title>
          </rect>
        );
      })}

      {nights.map((n, i) =>
        i % Math.ceil(nights.length / 12) === 0 ? (
          <text
            key={`l${n.dayKey}`}
            className={styles.axisText}
            x={padL + (i * plotW) / nights.length + barW / 2}
            y={height - 6}
            textAnchor="middle"
          >
            {shortDay(n.dayKey)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Onset and wake clock times per night on a night-centred axis. */
export function OnsetWakeChart({ nights }: NightChartProps) {
  if (nights.length === 0) return <p className={styles.empty}>No nights in range.</p>;

  const width = 900;
  const height = 220;
  const padL = 42;
  const padB = 22;
  const plotW = width - padL - 8;
  const plotH = height - padB - 10;
  // Axis runs 12:00 -> 12:00 so an onset at 01:00 sits below one at 23:00.
  const y = (min: number) => 10 + ((nightAxisMinutes(min) - 720) / DAY) * plotH;

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Sleep onset and wake time per night"
    >
      {[12, 16, 20, 24, 28, 32, 36].map((h) => (
        <g key={h}>
          <line
            className={styles.gridLine}
            x1={padL}
            x2={width - 8}
            y1={10 + ((h * 60 - 720) / DAY) * plotH}
            y2={10 + ((h * 60 - 720) / DAY) * plotH}
          />
          <text
            className={styles.axisText}
            x={padL - 5}
            y={13 + ((h * 60 - 720) / DAY) * plotH}
            textAnchor="end"
          >
            {formatClock(h * 60)}
          </text>
        </g>
      ))}

      {nights.map((n, i) => {
        const x = padL + ((i + 0.5) * plotW) / nights.length;
        const yOnset = y(n.onsetMinutes);
        const yWake = y(n.wakeMinutes);
        const dim = n.confidence === 'reconstructed' ? 0.45 : 1;
        return (
          <g key={n.dayKey} opacity={dim}>
            <line x1={x} x2={x} y1={yOnset} y2={yWake} stroke="var(--doc-sleep-soft)" strokeWidth={2} />
            <circle cx={x} cy={yOnset} r={2.4} fill="var(--doc-sleep)">
              <title>{`${n.dayKey} — asleep ${formatClock(n.onsetMinutes)}`}</title>
            </circle>
            <circle cx={x} cy={yWake} r={2.4} fill="var(--doc-accent)">
              <title>{`${n.dayKey} — awake ${formatClock(n.wakeMinutes)}`}</title>
            </circle>
          </g>
        );
      })}
    </svg>
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
  if (days.length === 0) return <p className={styles.empty}>Nothing logged in range.</p>;

  const width = 900;
  const height = 160;
  const padL = 26;
  const padB = 22;
  const plotW = width - padL - 8;
  const plotH = height - padB - 10;
  const max = Math.max(3, ...days.map((d) => d.count));
  const barW = Math.max(2, plotW / days.length - 1.5);
  const y = (v: number) => 10 + plotH - (v / max) * plotH;

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label} per day`}
    >
      {Array.from({ length: max + 1 }, (_, v) => v).map((v) => (
        <g key={v}>
          <line className={styles.gridLine} x1={padL} x2={width - 8} y1={y(v)} y2={y(v)} />
          <text className={styles.axisText} x={padL - 5} y={y(v) + 3} textAnchor="end">
            {v}
          </text>
        </g>
      ))}

      {days.map((d, i) => {
        const x = padL + (i * plotW) / days.length;
        if (!d.covered) {
          return (
            <rect key={d.dayKey} x={x} y={10} width={barW} height={plotH} fill="var(--doc-void)">
              <title>{`${d.dayKey} — not tracked`}</title>
            </rect>
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
          >
            <title>{`${d.dayKey} — ${d.count} ${label.toLowerCase()}`}</title>
          </rect>
        );
      })}

      {days.map((d, i) =>
        i % Math.ceil(days.length / 12) === 0 ? (
          <text
            key={`l${d.dayKey}`}
            className={styles.axisText}
            x={padL + (i * plotW) / days.length + barW / 2}
            y={height - 6}
            textAnchor="middle"
          >
            {shortDay(d.dayKey)}
          </text>
        ) : null,
      )}
    </svg>
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
  if (points.length === 0) return <p className={styles.empty}>Nothing logged in range.</p>;

  const width = 900;
  const height = 200;
  const padL = 42;
  const padB = 22;
  const plotW = width - padL - 8;
  const plotH = height - padB - 10;
  const index = new Map(dayKeys.map((k, i) => [k, i]));
  const y = (min: number) => 10 + (min / DAY) * plotH;
  const x = (key: string) =>
    padL + (((index.get(key) ?? 0) + 0.5) * plotW) / Math.max(1, dayKeys.length);

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label} timing by day`}
    >
      {[0, 4, 8, 12, 16, 20, 24].map((h) => (
        <g key={h}>
          <line className={styles.gridLine} x1={padL} x2={width - 8} y1={y(h * 60)} y2={y(h * 60)} />
          <text className={styles.axisText} x={padL - 5} y={y(h * 60) + 3} textAnchor="end">
            {formatClock(h * 60 === DAY ? 0 : h * 60)}
          </text>
        </g>
      ))}
      {cutoffHour !== undefined && (
        <line
          className={styles.refLine}
          x1={padL}
          x2={width - 8}
          y1={y(cutoffHour * 60)}
          y2={y(cutoffHour * 60)}
        />
      )}

      {points.map((p, i) => (
        <circle key={`${p.atIso}-${i}`} cx={x(p.dayKey)} cy={y(p.minutes)} r={2.6} fill={color}>
          <title>{`${p.dayKey} ${formatClock(p.minutes)} — ${p.label}`}</title>
        </circle>
      ))}
    </svg>
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
  if (mood.length === 0 && energy.length === 0) {
    return <p className={styles.empty}>No self-ratings in range.</p>;
  }

  const width = 900;
  const height = 160;
  const padL = 26;
  const padB = 22;
  const plotW = width - padL - 8;
  const plotH = height - padB - 10;
  const index = new Map(dayKeys.map((k, i) => [k, i]));
  const y = (v: number) => 10 + plotH - ((v - 1) / 4) * plotH;
  const x = (key: string) =>
    padL + (((index.get(key) ?? 0) + 0.5) * plotW) / Math.max(1, dayKeys.length);

  const series = [
    { points: mood, color: 'var(--doc-accent)' },
    { points: energy, color: 'var(--doc-caff)' },
  ];

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Mood and energy self-ratings, 1 to 5"
    >
      {[1, 2, 3, 4, 5].map((v) => (
        <g key={v}>
          <line className={styles.gridLine} x1={padL} x2={width - 8} y1={y(v)} y2={y(v)} />
          <text className={styles.axisText} x={padL - 5} y={y(v) + 3} textAnchor="end">
            {v}
          </text>
        </g>
      ))}

      {series.map((s, si) => (
        <g key={si}>
          {s.points.map((p, i) => (
            <circle key={`${si}-${i}`} cx={x(p.dayKey)} cy={y(p.value)} r={2.8} fill={s.color}>
              <title>{`${p.dayKey} — ${p.value}/5`}</title>
            </circle>
          ))}
        </g>
      ))}
    </svg>
  );
}
