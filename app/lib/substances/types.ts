/**
 * The substance registry.
 *
 * Deliberately *not* a database table: these are four things the user takes,
 * they change once a year, and putting them in Postgres would mean building a
 * CRUD screen for a list that fits on a napkin. It is a JSON file, and adding
 * an entry needs no code change and — when the file lives on the mounted
 * volume — no rebuild either. See `registry.ts` for the lookup order.
 */

export type TimeHint = 'morning' | 'midday' | 'evening' | 'night';

export interface Substance {
  /** Stable slug. Written to `events.kind`, so renaming one orphans history. */
  id: string;
  /** What the button says. */
  name: string;
  /** The `type` half of the `intake:{type} — {dose}{unit}` row label. */
  type: string;
  /** Omitted when the dose isn't settled yet (vitamin D3) — the tile then
   *  routes to the sheet instead of logging blind. */
  defaultDose?: number;
  unit: string;
  timeHint?: TimeHint;
}

export const TIME_HINTS: readonly TimeHint[] = ['morning', 'midday', 'evening', 'night'];

/** Slug rules, enforced on both the file and any posted `substance`. */
const ID_MAX = 40;
const NAME_MAX = 40;
const TYPE_MAX = 40;
const UNIT_MAX = 12;

export function isSubstanceId(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.length > 0 &&
    v.length <= ID_MAX &&
    v.match(/^[a-z0-9][a-z0-9_-]*$/) !== null
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validate one entry. The registry is user-edited JSON, so it is untrusted
 * input like any other boundary — a typo should drop one tile, not take the
 * whole view down.
 */
export function parseSubstance(v: unknown): Substance | null {
  if (!isRecord(v)) return null;
  if (!isSubstanceId(v.id)) return null;
  if (typeof v.name !== 'string' || v.name.length === 0 || v.name.length > NAME_MAX) return null;
  if (typeof v.type !== 'string' || v.type.length === 0 || v.type.length > TYPE_MAX) return null;
  if (typeof v.unit !== 'string' || v.unit.length === 0 || v.unit.length > UNIT_MAX) return null;

  if (v.defaultDose !== undefined) {
    if (typeof v.defaultDose !== 'number' || !Number.isFinite(v.defaultDose)) return null;
    if (v.defaultDose <= 0 || v.defaultDose > 100_000) return null;
  }
  if (v.timeHint !== undefined && !(TIME_HINTS as readonly string[]).includes(v.timeHint as string)) {
    return null;
  }

  return {
    id: v.id,
    name: v.name,
    type: v.type,
    unit: v.unit,
    ...(v.defaultDose !== undefined ? { defaultDose: v.defaultDose as number } : {}),
    ...(v.timeHint !== undefined ? { timeHint: v.timeHint as TimeHint } : {}),
  };
}

/** Parse a whole registry file, dropping malformed entries and duplicate ids. */
export function parseRegistry(raw: unknown): Substance[] {
  const list = isRecord(raw) && Array.isArray(raw.substances) ? raw.substances : [];
  const seen = new Set<string>();
  const out: Substance[] = [];
  for (const entry of list) {
    const parsed = parseSubstance(entry);
    if (!parsed || seen.has(parsed.id)) continue;
    seen.add(parsed.id);
    out.push(parsed);
  }
  return out;
}
