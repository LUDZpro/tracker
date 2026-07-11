import { NextResponse } from 'next/server';
import { invalidateToday } from '@/lib/cache';
import { errorResponse, jsonError, readJson } from '@/lib/http';
import { createEvent, queryEventsSince } from '@/lib/notion';
import { buildSleepPairs, checkSleepSpan, overlapsPairs, sortByTime } from '@/lib/sleep';
import { toLocalISO } from '@/lib/time';
import { isPrecision } from '@/lib/validation';

/**
 * Backfill reaches up to 4 nights back (the missing-nights card covers 3),
 * wider than the ±48h rule that applies to live logging.
 */
const BACKFILL_WINDOW_MS = 4 * 24 * 60 * 60 * 1000;
const LOOKBACK_MS = 5 * 24 * 60 * 60 * 1000;

const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function isBackfillTimestamp(v: unknown, now: number): v is string {
  if (typeof v !== 'string' || !ISO_WITH_TZ.test(v)) return false;
  const t = Date.parse(v);
  return !Number.isNaN(t) && t <= now && now - t <= BACKFILL_WINDOW_MS;
}

export async function POST(req: Request) {
  const body = (await readJson(req)) as {
    sleep_start?: unknown;
    wake_up?: unknown;
    precision?: unknown;
  } | null;
  const now = Date.now();

  if (!body || !isBackfillTimestamp(body.sleep_start, now)) {
    return jsonError(400, 'sleep_start must be ISO 8601 with timezone, within the last 4 days');
  }
  if (body.wake_up !== undefined && !isBackfillTimestamp(body.wake_up, now)) {
    return jsonError(400, 'wake_up must be ISO 8601 with timezone, within the last 4 days');
  }
  if (!isPrecision(body.precision)) return jsonError(400, 'Unknown precision');

  const sleepStart = body.sleep_start;
  const explicitWake = body.wake_up as string | undefined;

  try {
    const since = toLocalISO(new Date(now - LOOKBACK_MS));
    const events = await queryEventsSince(since);
    const pairs = buildSleepPairs(events);

    // The wake that closes this backfilled night: provided, or the first
    // existing wake_up after the new sleep_start (the missing-bedtime flow).
    const wakeIso =
      explicitWake ??
      sortByTime(events).find(
        (e) => e.type === 'wake_up' && Date.parse(e.occurredAt) > Date.parse(sleepStart),
      )?.occurredAt;

    if (wakeIso) {
      const span = checkSleepSpan(sleepStart, wakeIso);
      if (!span.ok) return jsonError(422, span.error);
      if (overlapsPairs(pairs, sleepStart, wakeIso)) {
        return jsonError(422, 'This night overlaps an already-logged sleep period');
      }
    }

    const startId = await createEvent({
      type: 'sleep_start',
      occurred_at: sleepStart,
      precision: body.precision,
    });
    const wakeId = explicitWake
      ? await createEvent({ type: 'wake_up', occurred_at: explicitWake, precision: body.precision })
      : null;

    invalidateToday();
    return NextResponse.json(
      { sleep_start_id: startId, ...(wakeId ? { wake_up_id: wakeId } : {}) },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
