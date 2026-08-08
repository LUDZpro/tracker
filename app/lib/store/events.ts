/**
 * The event log, backed by Postgres.
 *
 * Replaces the old Notion client. Every function keeps the name and contract
 * the API routes already relied on, so the read/write paths above this file
 * are unchanged — with one deliberate exception: `updateEventFields` now takes
 * real field names instead of the `title`/`notes` strings Notion forced the
 * caller to rebuild by hand.
 */
import { query, StoreError } from '../db/pool';
import { EVENT_COLUMNS, fromEventRow, type EventRow } from '../db/rows';
import {
  CATEGORY_BY_TYPE,
  type AppEvent,
  type CaffeineKind,
  type EventPayload,
  type EventType,
  type ExerciseRow,
  type Precision,
} from '../types';

export { StoreError };

/** The instant behind an ISO string that carries its own offset. Stored
 *  next to the original text so ordering and range filters are correct;
 *  the text itself stays byte-identical for lib/time.ts to read. */
function instant(iso: string): Date {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new StoreError(400, 'occurred_at is not a valid timestamp');
  return new Date(t);
}

/** Create one event; returns the new id. */
export async function createEvent(payload: EventPayload): Promise<string> {
  // gym-session minutes get their own column now — no more sharing nap's.
  const rows = await query<{ id: string }>(
    `INSERT INTO events (
       type, category, occurred_at, occurred_ts, precision, duration, intensity,
       kind, scope, meal_name, description, protein_g, calories,
       session_duration, exercises, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id`,
    [
      payload.type,
      CATEGORY_BY_TYPE[payload.type],
      payload.occurred_at,
      instant(payload.occurred_at),
      payload.precision,
      payload.duration ?? null,
      payload.intensity ?? null,
      // Supplements ride columns that already exist: substance shares `kind`
      // with caffeine, dose shares `description` with meals. See lib/db/rows.ts
      // for the read side — no supplement-only column was added.
      payload.kind ?? payload.substance ?? null,
      payload.scope ?? null,
      payload.mealName ?? null,
      payload.description ?? payload.dose ?? null,
      payload.proteinG ?? null,
      payload.calories ?? null,
      payload.sessionDuration ?? null,
      payload.exercises ? JSON.stringify(payload.exercises) : null,
      payload.note ?? null,
    ],
  );
  return rows[0].id;
}

/** Editable fields on an existing event. */
export interface EventFieldPatch {
  occurredAt?: string;
  precision?: Precision;
  duration?: number;
  intensity?: number;
  kind?: CaffeineKind;
  mealName?: string;
  description?: string;
  proteinG?: number;
  calories?: number;
  sessionDuration?: number;
  exercises?: ExerciseRow[];
  substance?: string;
  dose?: string;
  note?: string;
}

const PATCH_COLUMNS: Record<keyof EventFieldPatch, string> = {
  occurredAt: 'occurred_at',
  precision: 'precision',
  duration: 'duration',
  intensity: 'intensity',
  kind: 'kind',
  mealName: 'meal_name',
  description: 'description',
  proteinG: 'protein_g',
  calories: 'calories',
  sessionDuration: 'session_duration',
  exercises: 'exercises',
  // Aliases onto columns that already exist — validation guarantees a patch
  // never carries both halves of a pair, and the dedupe below makes a
  // duplicate assignment impossible even if it somehow did.
  substance: 'kind',
  dose: 'description',
  note: 'notes',
};

/** Update only the fields present on `patch`. Column names come from the map
 *  above, never from caller input, so the SET clause can't be injected into. */
export async function updateEventFields(id: string, patch: EventFieldPatch): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const assigned = new Set<string>();

  for (const [key, column] of Object.entries(PATCH_COLUMNS) as [
    keyof EventFieldPatch,
    string,
  ][]) {
    const value = patch[key];
    if (value === undefined || assigned.has(column)) continue;
    assigned.add(column);
    values.push(key === 'exercises' ? JSON.stringify(value) : value);
    sets.push(`${column} = $${values.length}`);
  }

  // Re-timing must move the sortable instant with the text, or the event
  // would keep its old position in every query.
  if (patch.occurredAt !== undefined) {
    values.push(instant(patch.occurredAt));
    sets.push(`occurred_ts = $${values.length}`);
  }
  if (sets.length === 0) return;

  values.push(id);
  await query(
    `UPDATE events SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $${values.length} AND archived_at IS NULL`,
    values,
  );
}

/** Soft-delete an event — reversible, exactly as Notion's archive was. */
export async function archiveEvent(id: string): Promise<void> {
  await query('UPDATE events SET archived_at = now() WHERE id = $1 AND archived_at IS NULL', [id]);
}

/** Retrieve a single event; null when missing or already archived. */
export async function retrieveEvent(id: string): Promise<AppEvent | null> {
  // A malformed id would make Postgres reject the uuid cast; treat it as
  // "not found" rather than a 502, which is what the caller means by it.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;

  const rows = await query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM events WHERE id = $1 AND archived_at IS NULL`,
    [id],
  );
  return rows.length > 0 ? fromEventRow(rows[0]) : null;
}

/** All live events at or after `sinceIso`, oldest first. */
export async function queryEventsSince(sinceIso: string): Promise<AppEvent[]> {
  const rows = await query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM events
     WHERE archived_at IS NULL AND occurred_ts >= $1
     ORDER BY occurred_ts ASC`,
    [instant(sinceIso)],
  );
  return rows.map(fromEventRow).filter((e): e is AppEvent => e !== null);
}

/**
 * Every live event, oldest first — the whole record, not a window.
 *
 * Only the clinical report calls this. It is deliberately unpaginated
 * because the report's whole point is the full span; the row count is in
 * the hundreds and the route caches the result.
 */
export async function queryAllEvents(): Promise<AppEvent[]> {
  const rows = await query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM events
     WHERE archived_at IS NULL
     ORDER BY occurred_ts ASC`,
  );
  return rows.map(fromEventRow).filter((e): e is AppEvent => e !== null);
}

/** One page of a single event type, newest first. `before` is a plain ISO
 *  timestamp (the previous page's oldest event), keeping the client-facing
 *  cursor simple. Fetches one extra row to answer hasMore without a count. */
export async function queryEventsByType(
  type: EventType,
  opts: { before?: string; limit: number },
): Promise<{ events: AppEvent[]; hasMore: boolean }> {
  const values: unknown[] = [type];
  let where = 'archived_at IS NULL AND type = $1';
  if (opts.before) {
    values.push(instant(opts.before));
    where += ` AND occurred_ts < $${values.length}`;
  }
  values.push(opts.limit + 1);

  const rows = await query<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM events
     WHERE ${where}
     ORDER BY occurred_ts DESC
     LIMIT $${values.length}`,
    values,
  );

  const hasMore = rows.length > opts.limit;
  const events = rows
    .slice(0, opts.limit)
    .map(fromEventRow)
    .filter((e): e is AppEvent => e !== null);
  return { events, hasMore };
}
