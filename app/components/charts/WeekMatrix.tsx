import type { GoalState } from '@/lib/goals';
import styles from './charts.module.css';

export interface MatrixRow {
  /** Tracker name shown in the row header. */
  label: string;
  /** One state per day, aligned with `dayLabels`. */
  states: GoalState[];
  /** Per-cell accessible sentence, aligned with `states`. */
  titles: string[];
}

interface Props {
  dayLabels: string[];
  /** Index of today's column, or -1. */
  todayIndex: number;
  rows: MatrixRow[];
  /** "Week of 20 Jul" */
  caption: string;
  /** "4 of 5 trackers on plan" */
  summary: string;
}

/** Shape first, fill second — the grid must survive grayscale. */
function Glyph({ state }: { state: GoalState }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (state) {
    case 'goal':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M20 6 9 17l-5-5" {...common} />
        </svg>
      );
    case 'over':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="m5 15 7-7 7 7" {...common} />
        </svg>
      );
    case 'under':
    case 'bad':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="m5 9 7 7 7-7" {...common} />
        </svg>
      );
    case 'partial':
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M7 12h10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
  }
}

/**
 * Every tracker as a row, every day as a column. The vertical read is the one
 * no other screen offers — a hole across four trackers on one day, a short
 * night sitting under a second late coffee.
 *
 * It ships as a real <table> with headers on both axes, so it is at once the
 * glanceable view and the structured data view the chart contract requires.
 * Spec: charts-lab.html §C12.
 */
export default function WeekMatrix({
  dayLabels,
  todayIndex,
  rows,
  caption,
  summary,
}: Props) {
  return (
    <>
      <div className={styles.key}>
        <span>{caption}</span>
        <b>{summary}</b>
      </div>

      <table className={styles.matrix}>
        <caption className={styles.srOnly}>
          {caption}. {summary}. Each cell states one tracker&apos;s result for one day.
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <span className={styles.srOnly}>Tracker</span>
            </th>
            {dayLabels.map((d, i) => (
              <th
                key={`${d}-${i}`}
                scope="col"
                className={i === todayIndex ? styles.mToday : ''}
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.states.map((state, i) => (
                <td key={`${row.label}-${i}`} className={i === todayIndex ? styles.mToday : ''}>
                  <span className={styles.cell} data-state={state}>
                    <Glyph state={state} />
                    <span className={styles.srOnly}>{row.titles[i]}</span>
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.legend} aria-hidden>
        <span>
          <i />
          in goal
        </span>
        <span>
          <i className={styles.lWarn} />
          over / under
        </span>
        <span>
          <i className={styles.lBad} />
          well outside
        </span>
        <span>
          <i className={styles.lNone} />
          not logged
        </span>
      </div>
    </>
  );
}
