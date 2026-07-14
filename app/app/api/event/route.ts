import { NextResponse } from 'next/server';
import { invalidateHistory, invalidateToday } from '@/lib/cache';
import { errorResponse, jsonError, readJson } from '@/lib/http';
import { archiveEvent, createEvent } from '@/lib/notion';
import { addMinutes } from '@/lib/time';
import { validateEventPayload } from '@/lib/validation';
import type { EventPayload, Precision } from '@/lib/types';

async function createSleepWakePairFromNap(payload: {
  occurred_at: string;
  precision: Precision;
  duration: number;
}): Promise<{ sleepId: string; wakeId: string }> {
  const sleepPayload: EventPayload = {
    type: 'sleep_start',
    occurred_at: addMinutes(payload.occurred_at, -payload.duration),
    precision: payload.precision,
  };
  const wakePayload: EventPayload = {
    type: 'wake_up',
    occurred_at: payload.occurred_at,
    precision: payload.precision,
  };

  const sleepId = await createEvent(sleepPayload);
  try {
    const wakeId = await createEvent(wakePayload);
    return { sleepId, wakeId };
  } catch (e) {
    await archiveEvent(sleepId).catch(() => {});
    throw e;
  }
}

export async function POST(req: Request) {
  const body = await readJson(req);
  const result = validateEventPayload(body);
  if (!result.ok) return jsonError(400, result.error);

  try {
    if (result.value.type === 'nap' && result.value.duration !== undefined) {
      const { sleepId, wakeId } = await createSleepWakePairFromNap({
        occurred_at: result.value.occurred_at,
        precision: result.value.precision,
        duration: result.value.duration,
      });
      invalidateToday();
      invalidateHistory('sleep_start');
      invalidateHistory('wake_up');
      return NextResponse.json({ id: wakeId, ids: [sleepId, wakeId] }, { status: 201 });
    }

    const id = await createEvent(result.value);
    invalidateToday();
    invalidateHistory(result.value.type);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
