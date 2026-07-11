'use client';

import type { EventPatch, EventPayload, TodayResponse } from '@/lib/types';

export type PostResult =
  | { status: 'created'; id: string }
  | { status: 'queued' }
  | { status: 'error'; message: string };

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === 'string') return data.error;
  } catch {
    /* fall through */
  }
  return `Request failed (${res.status})`;
}

/** POST an event; a 202 means the service worker queued it offline. */
export async function postEvent(
  payload: EventPayload & { client_tag: string },
): Promise<PostResult> {
  try {
    const res = await fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 201) {
      const { id } = await res.json();
      return { status: 'created', id };
    }
    if (res.status === 202) return { status: 'queued' };
    return { status: 'error', message: await readError(res) };
  } catch {
    return { status: 'error', message: 'Offline and no queue available — retry' };
  }
}

/** offset = wake-windows back (0–7); a 404 means history ends before that. */
export async function fetchToday(offset = 0): Promise<TodayResponse> {
  const res = await fetch(offset > 0 ? `/api/today?offset=${offset}` : '/api/today');
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (res.status === 404) throw new Error('No more history');
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function undoEvent(id: string): Promise<void> {
  const res = await fetch(`/api/event/${id}/undo`, { method: 'POST' });
  if (!res.ok && res.status !== 404) throw new Error(await readError(res));
}

export async function patchEvent(
  id: string,
  body: EventPatch,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(`/api/event/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  return { ok: false, message: await readError(res) };
}

export async function backfillSleep(body: {
  sleep_start: string;
  wake_up?: string;
  precision: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch('/api/sleep/backfill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok || res.status === 202) return { ok: true };
  return { ok: false, message: await readError(res) };
}

export async function convertToNap(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(`/api/event/${id}/convert-nap`, { method: 'POST' });
  if (res.ok) return { ok: true };
  return { ok: false, message: await readError(res) };
}
