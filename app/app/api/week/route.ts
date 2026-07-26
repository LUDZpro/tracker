import { NextResponse } from 'next/server';
import { getCachedWeek, setCachedWeek } from '@/lib/cache';
import { errorResponse } from '@/lib/http';
import { queryEventsSince } from '@/lib/store/events';
import { shiftDateKey, toLocalISO, wallDateKey } from '@/lib/time';
import { EDIT_WINDOW_MS } from '@/lib/validation';
import type { WeekResponse } from '@/lib/types';

const WINDOW_DAYS = 7;

/**
 * All events (every type, unlike /api/today's floor-only view) for the last
 * 7 full calendar days plus one spare day, so the oldest displayed night's
 * sleep_start — which precedes its wake day — is still in the payload.
 */
export async function GET() {
  const cached = getCachedWeek<WeekResponse>();
  if (cached) {
    return NextResponse.json({ ...cached, now: toLocalISO(new Date()) });
  }

  try {
    const nowDate = new Date();
    const nowIso = toLocalISO(nowDate);
    const sinceKey = shiftDateKey(wallDateKey(nowIso), -WINDOW_DAYS);
    const since = `${sinceKey}T00:00:00${nowIso.slice(19)}`;

    const events = (await queryEventsSince(since)).map((e) => ({
      ...e,
      editable: nowDate.getTime() - Date.parse(e.occurredAt) <= EDIT_WINDOW_MS,
    }));

    const payload: WeekResponse = { now: nowIso, events };
    setCachedWeek(payload);
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
