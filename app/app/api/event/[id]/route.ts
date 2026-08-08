import { NextResponse } from 'next/server';
import { invalidateHistory, invalidateToday } from '@/lib/cache';
import { errorResponse, jsonError, readJson } from '@/lib/http';
import { queryEventsSince, retrieveEvent, updateEventFields } from '@/lib/store/events';
import { buildSleepPairs, checkSleepSpan, overlapsPairs } from '@/lib/sleep';
import { toLocalISO } from '@/lib/time';
import { EDIT_WINDOW_MS, patchMismatch, validatePatchBody } from '@/lib/validation';
import type { AppEvent } from '@/lib/types';

const LOOKBACK_MS = 5 * 24 * 60 * 60 * 1000;

type Ctx = { params: Promise<{ id: string }> };

/** For a marker being re-timed, check ordering/span/overlap against its pair. */
async function checkMarkerMove(ev: AppEvent, newIso: string): Promise<string | null> {
  const since = toLocalISO(new Date(Date.now() - LOOKBACK_MS));
  const pairs = buildSleepPairs(await queryEventsSince(since));
  const pair = pairs.find((p) => p.start.id === ev.id || p.end.id === ev.id);
  if (!pair) return null; // dangling marker — nothing to order against

  const startIso = ev.id === pair.start.id ? newIso : pair.start.occurredAt;
  const endIso = ev.id === pair.end.id ? newIso : pair.end.occurredAt;
  const span = checkSleepSpan(startIso, endIso);
  if (!span.ok) return span.error;
  if (overlapsPairs(pairs, startIso, endIso, [pair.start.id, pair.end.id])) {
    return 'This time overlaps another sleep period';
  }
  return null;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const now = new Date();
  const parsed = validatePatchBody(await readJson(req), now);
  if (!parsed.ok) return jsonError(400, parsed.error);
  const patch = parsed.value;

  try {
    const ev = await retrieveEvent(id);
    if (!ev) return jsonError(404, 'Event not found');
    if (now.getTime() - Date.parse(ev.occurredAt) > EDIT_WINDOW_MS) {
      return jsonError(409, 'This event is older than 48h and can no longer be edited');
    }

    const mismatch = patchMismatch(ev.type, patch);
    if (mismatch) return jsonError(422, mismatch);

    if (patch.occurred_at && ev.category === 'marker') {
      const problem = await checkMarkerMove(ev, patch.occurred_at);
      if (problem) return jsonError(422, problem);
    }

    // Every field is its own column now — no derived title to keep honest and
    // no Notes envelope to rebuild, so the patch maps across one-to-one.
    await updateEventFields(id, {
      occurredAt: patch.occurred_at,
      precision: patch.precision,
      kind: patch.kind,
      intensity: patch.intensity,
      duration: patch.duration,
      mealName: patch.mealName,
      description: patch.description,
      proteinG: patch.proteinG,
      calories: patch.calories,
      sessionDuration: patch.sessionDuration,
      exercises: patch.exercises,
      substance: patch.substance,
      dose: patch.dose,
      note: patch.note,
    });
    invalidateToday();
    invalidateHistory(ev.type);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
