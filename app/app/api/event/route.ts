import { NextResponse } from 'next/server';
import { invalidateHistory, invalidateToday } from '@/lib/cache';
import { errorResponse, jsonError, readJson } from '@/lib/http';
import { createEvent } from '@/lib/notion';
import { validateEventPayload } from '@/lib/validation';

export async function POST(req: Request) {
  const body = await readJson(req);
  const result = validateEventPayload(body);
  if (!result.ok) return jsonError(400, result.error);

  try {
    const id = await createEvent(result.value);
    invalidateToday();
    invalidateHistory(result.value.type);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
