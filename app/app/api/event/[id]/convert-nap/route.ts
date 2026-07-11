import { NextResponse } from 'next/server';
import { invalidateToday } from '@/lib/cache';
import { errorResponse, jsonError } from '@/lib/http';
import { archiveEvent, createEvent, queryEventsSince } from '@/lib/notion';
import { buildSleepPairs } from '@/lib/sleep';
import { minutesBetween, toLocalISO } from '@/lib/time';

const LOOKBACK_MS = 5 * 24 * 60 * 60 * 1000;
const NAP_MAX_MINUTES = 600;

type Ctx = { params: Promise<{ id: string }> };

/**
 * Convert the sleep pair containing event [id] into a single action:nap.
 * Creates the nap first, then archives both markers.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const since = toLocalISO(new Date(Date.now() - LOOKBACK_MS));
    const pairs = buildSleepPairs(await queryEventsSince(since));
    const pair = pairs.find((p) => p.start.id === id || p.end.id === id);
    if (!pair) return jsonError(404, 'No completed sleep pair found for this event');

    const duration = minutesBetween(pair.start.occurredAt, pair.end.occurredAt);
    if (duration < 1 || duration > NAP_MAX_MINUTES) {
      return jsonError(422, 'This sleep period is too long to be a nap');
    }

    const napId = await createEvent({
      type: 'nap',
      occurred_at: pair.start.occurredAt,
      precision: pair.start.precision,
      duration,
    });
    await archiveEvent(pair.start.id);
    await archiveEvent(pair.end.id);
    invalidateToday();
    return NextResponse.json({ id: napId }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
