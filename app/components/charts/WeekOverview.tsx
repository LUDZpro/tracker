'use client';

import { buildMatrixRows, buildWeekCharts } from '@/lib/weekCharts';
import type { WeekResponse } from '@/lib/types';
import WeekMatrix from './WeekMatrix';

interface Props {
  week: WeekResponse | null;
  todayKey: string;
  error: string | null;
}

/**
 * "How is my week going?" across every tracker at once — the question four
 * separate single-metric charts never answered. Shared by both surfaces so
 * the phone and the desktop cannot disagree.
 */
export default function WeekOverview({ week, todayKey, error }: Props) {
  if (!week) return null;

  const charts = buildWeekCharts(week.events, todayKey);
  const rows = buildMatrixRows(charts);

  // "On plan" = no breach anywhere in the row this week. Stated as a count
  // over a denominator, never as a score or a grade.
  const onPlan = rows.filter((r) =>
    r.states.every((s) => s !== 'over' && s !== 'under' && s !== 'bad'),
  ).length;

  const first = charts.dayKeys[0];
  const caption = `Week of ${new Date(`${first}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })}`;

  return (
    <WeekMatrix
      dayLabels={charts.dayLetters}
      todayIndex={charts.todayIndex}
      rows={rows}
      caption={error ? `${caption} · stale` : caption}
      summary={`${onPlan} of ${rows.length} trackers on plan`}
    />
  );
}
