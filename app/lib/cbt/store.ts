/**
 * CBT thought records, backed by Postgres. Same three functions the Notion
 * client exposed; the routes above are unchanged.
 *
 * Distortions and the two evidence lists are real `text[]` columns now — no
 * more newline-joining them into one rich_text blob and splitting on read.
 */
import { query } from '../db/pool';
import { CBT_DISTORTIONS, CBT_EMOTIONS } from './types';
import type { CbtDistortion, CbtEmotion, CbtRecord, CbtRecordPayload } from './types';

interface CbtRow {
  id: string;
  occurred_at: string;
  trigger: string;
  thought: string;
  emotion: string;
  intensity_before: number;
  intensity_after: number;
  distortions: string[] | null;
  evidence_for: string[] | null;
  evidence_against: string[] | null;
  reframe: string;
}

const COLUMNS = `
  id, occurred_at, trigger, thought, emotion, intensity_before,
  intensity_after, distortions, evidence_for, evidence_against, reframe
`;

/** Map a row to a CbtRecord; null if the emotion is one the app no longer
 *  knows, matching the old parser's tolerance for foreign values. */
function fromCbtRow(row: CbtRow): CbtRecord | null {
  if (!(CBT_EMOTIONS as readonly string[]).includes(row.emotion)) return null;

  return {
    id: row.id,
    occurredAt: row.occurred_at,
    trigger: row.trigger,
    thought: row.thought,
    emotion: row.emotion as CbtEmotion,
    intensityBefore: row.intensity_before,
    intensityAfter: row.intensity_after,
    distortions: (row.distortions ?? []).filter((d): d is CbtDistortion =>
      (CBT_DISTORTIONS as readonly string[]).includes(d),
    ),
    evidenceFor: row.evidence_for ?? [],
    evidenceAgainst: row.evidence_against ?? [],
    reframe: row.reframe,
  };
}

/** Create one thought record; returns the new id. */
export async function createCbtRecord(payload: CbtRecordPayload): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO cbt_records (
       occurred_at, occurred_ts, trigger, thought, emotion, intensity_before,
       intensity_after, distortions, evidence_for, evidence_against, reframe
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      payload.occurred_at,
      new Date(payload.occurred_at),
      payload.trigger,
      payload.thought,
      payload.emotion,
      payload.intensityBefore,
      payload.intensityAfter,
      payload.distortions,
      payload.evidenceFor,
      payload.evidenceAgainst,
      payload.reframe,
    ],
  );
  return rows[0].id;
}

/** Newest-first page of thought records; `before` is a plain ISO timestamp
 *  (the previous page's oldest record), same cursor style as /api/history. */
export async function queryCbtRecords(opts: {
  before?: string;
  limit: number;
}): Promise<{ records: CbtRecord[]; hasMore: boolean }> {
  const values: unknown[] = [];
  let where = 'archived_at IS NULL';
  if (opts.before) {
    values.push(new Date(opts.before));
    where += ` AND occurred_ts < $${values.length}`;
  }
  values.push(opts.limit + 1);

  const rows = await query<CbtRow>(
    `SELECT ${COLUMNS} FROM cbt_records
     WHERE ${where}
     ORDER BY occurred_ts DESC
     LIMIT $${values.length}`,
    values,
  );

  const hasMore = rows.length > opts.limit;
  const records = rows
    .slice(0, opts.limit)
    .map(fromCbtRow)
    .filter((r): r is CbtRecord => r !== null);
  return { records, hasMore };
}

/** Soft-delete a thought record — reversible, as the Notion archive was. */
export async function archiveCbtRecord(id: string): Promise<void> {
  await query('UPDATE cbt_records SET archived_at = now() WHERE id = $1 AND archived_at IS NULL', [
    id,
  ]);
}
