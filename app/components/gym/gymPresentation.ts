import type { AppEvent } from '@/lib/types';

export const GYM_COLOR = 'var(--state)';
export const GYM_ICON = '💪';

/** "N exercises · Mmin" per the row contract. */
export function gymSummary(ev: AppEvent): string {
  const count = ev.exercises?.length ?? 0;
  const exercises = `${count} exercise${count === 1 ? '' : 's'}`;
  return ev.sessionDuration !== undefined ? `${exercises} · ${ev.sessionDuration}min` : exercises;
}
