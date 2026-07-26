import { NextResponse } from 'next/server';
import { getCachedHistory, setCachedHistory } from '@/lib/cache';
import { errorResponse, jsonError } from '@/lib/http';
import { queryEventsByType } from '@/lib/store/events';
import type { EventType, HistoryResponse } from '@/lib/types';

const HISTORY_TYPES = new Set<EventType>(['meal', 'gym-session']);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function isHistoryType(value: string | null): value is EventType {
  return value !== null && HISTORY_TYPES.has(value as EventType);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  if (!isHistoryType(type)) {
    return jsonError(400, 'type must be one of: meal, gym-session');
  }

  const before = url.searchParams.get('before') ?? undefined;
  const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT;

  if (!before) {
    const cached = getCachedHistory<HistoryResponse>(type);
    if (cached) return NextResponse.json(cached);
  }

  try {
    const { events, hasMore } = await queryEventsByType(type, { before, limit });
    const nextCursor = hasMore && events.length > 0 ? events[events.length - 1].occurredAt : null;
    const payload: HistoryResponse = { events, nextCursor };
    if (!before) setCachedHistory(type, payload);
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
