import { NextResponse } from 'next/server';
import { getCachedToday, setCachedToday } from '@/lib/cache';
import { errorResponse, jsonError } from '@/lib/http';
import { queryEventsSince } from '@/lib/notion';
import { currentState, lastSleep, missingNights, wakeWindowAt } from '@/lib/sleep';
import { toLocalISO, wallDateKey } from '@/lib/time';
import { EDIT_WINDOW_MS } from '@/lib/validation';
import type { AppEvent, TodayResponse } from '@/lib/types';

const MAX_OFFSET = 7;
const BASE_LOOKBACK_DAYS = 4;

/** 48h rule, precomputed server-side so the client doesn't guess. */
function withEditable(events: AppEvent[], now: Date): AppEvent[] {
  return events.map((e) => ({
    ...e,
    editable: now.getTime() - Date.parse(e.occurredAt) <= EDIT_WINDOW_MS,
  }));
}

function pairWithEditable(
  pair: { start: AppEvent | null; end: AppEvent | null },
  now: Date,
): { start: AppEvent | null; end: AppEvent | null } {
  return {
    start: pair.start ? withEditable([pair.start], now)[0] : null,
    end: pair.end ? withEditable([pair.end], now)[0] : null,
  };
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('offset') ?? '0';
  const offset = Number(raw);
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    return jsonError(400, `offset must be an integer between 0 and ${MAX_OFFSET}`);
  }

  if (offset === 0) {
    const cached = getCachedToday<TodayResponse>();
    if (cached) {
      return NextResponse.json({ ...cached, now: toLocalISO(new Date()) });
    }
  }

  try {
    // Wake-windows ≈ one per day; look back far enough to delimit window n.
    const lookbackMs = (BASE_LOOKBACK_DAYS + offset) * 24 * 60 * 60 * 1000;
    const since = toLocalISO(new Date(Date.now() - lookbackMs));
    const events = await queryEventsSince(since);
    const nowDate = new Date();
    const nowIso = toLocalISO(nowDate);

    const win = wakeWindowAt(events, nowIso, offset);
    if (!win) return jsonError(404, 'No wake-window that far back');

    // §6: expose only the requested wake-window plus its sleep pair.
    const payload: TodayResponse = {
      now: nowIso,
      state: currentState(events),
      events: withEditable(win.events, nowDate),
      last_sleep: pairWithEditable(
        offset === 0
          ? lastSleep(events)
          : { start: win.pair?.start ?? null, end: win.pair?.end ?? null },
        nowDate,
      ),
      missing_nights: offset === 0 ? missingNights(events, nowIso) : [],
      offset,
      axis_date: win.anchor ? wallDateKey(win.anchor.occurredAt) : wallDateKey(nowIso),
    };
    if (offset === 0) setCachedToday(payload);
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
