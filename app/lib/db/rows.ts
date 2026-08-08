import { CATEGORY_BY_TYPE, type AppEvent, type EventType, type ExerciseRow, type Precision } from '../types';
import type { CaffeineKind } from '../types';

/** Shape of one `events` row as pg returns it. */
export interface EventRow {
  id: string;
  type: string;
  occurred_at: string;
  precision: string | null;
  duration: number | null;
  intensity: number | null;
  kind: string | null;
  scope: string | null;
  meal_name: string | null;
  description: string | null;
  protein_g: string | number | null;
  calories: string | number | null;
  session_duration: number | null;
  exercises: ExerciseRow[] | null;
  notes: string | null;
}

/** `numeric` comes back as a string to preserve precision; the app wants a
 *  number, and a non-finite value is treated as absent rather than NaN. */
function num(v: string | number | null): number | undefined {
  if (v === null) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Map a row to an AppEvent. Rows whose `type` the app no longer knows are
 * dropped (null) rather than thrown on — same tolerance the Notion parser had,
 * so one odd row can never break a whole day's feed.
 */
export function fromEventRow(row: EventRow): AppEvent | null {
  const type = row.type as EventType;
  if (!(type in CATEGORY_BY_TYPE) || !row.occurred_at) return null;

  const exercises = Array.isArray(row.exercises) ? row.exercises : undefined;

  // Supplements reuse three existing columns rather than adding their own:
  // kind → substance, description → dose, notes → note. Only this type reads
  // them that way, so `notes` stays invisible on the 139 legacy rows that
  // carry preserved Notion free text.
  const isSupplement = type === 'supplement';

  return {
    id: row.id,
    type,
    category: CATEGORY_BY_TYPE[type],
    occurredAt: row.occurred_at,
    precision: (row.precision as Precision) ?? 'exact',
    ...(row.duration !== null ? { duration: row.duration } : {}),
    ...(row.intensity !== null ? { intensity: row.intensity } : {}),
    ...(row.kind && !isSupplement ? { kind: row.kind as CaffeineKind } : {}),
    ...(row.kind && isSupplement ? { substance: row.kind } : {}),
    ...(row.meal_name ? { mealName: row.meal_name } : {}),
    ...(row.description !== null && !isSupplement ? { description: row.description } : {}),
    ...(row.description !== null && isSupplement ? { dose: row.description } : {}),
    ...(row.notes !== null && isSupplement ? { note: row.notes } : {}),
    ...(num(row.protein_g) !== undefined ? { proteinG: num(row.protein_g) } : {}),
    ...(num(row.calories) !== undefined ? { calories: num(row.calories) } : {}),
    ...(row.session_duration !== null ? { sessionDuration: row.session_duration } : {}),
    ...(exercises !== undefined ? { exercises } : {}),
  };
}

/** Column list shared by every events SELECT, so reads and `fromEventRow`
 *  can never drift apart. */
export const EVENT_COLUMNS = `
  id, type, occurred_at, precision, duration, intensity, kind, scope,
  meal_name, description, protein_g, calories, session_duration, exercises,
  notes
`;
