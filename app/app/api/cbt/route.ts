import { NextResponse } from 'next/server';
import { invalidateToday } from '@/lib/cache';
import { queryCbtRecords, createCbtRecord } from '@/lib/cbt/notion';
import { validateCbtPayload } from '@/lib/cbt/validation';
import { errorResponse, readJson } from '@/lib/http';
import { createEvent } from '@/lib/notion';
import type { CbtHistoryResponse } from '@/lib/cbt/types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const before = url.searchParams.get('before') ?? undefined;
  const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT) : DEFAULT_LIMIT;

  try {
    const { records, hasMore } = await queryCbtRecords({ before, limit });
    const nextCursor =
      hasMore && records.length > 0 ? records[records.length - 1].occurredAt : null;
    const payload: CbtHistoryResponse = { records, nextCursor };
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  const body = await readJson(req);
  const result = validateCbtPayload(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const id = await createCbtRecord(result.value);

    // The floor feed only records that a trigger happened — best-effort, so a
    // hiccup here never loses the thought record that was already saved.
    let triggerLogged = true;
    try {
      await createEvent({
        type: 'trigger',
        occurred_at: result.value.occurred_at,
        precision: 'exact',
      });
      invalidateToday();
    } catch {
      triggerLogged = false;
    }

    return NextResponse.json({ id, triggerLogged }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
