'use client';

import type { CbtHistoryResponse, CbtRecordPayload } from '@/lib/cbt/types';

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.error === 'string') return data.error;
  } catch {
    /* fall through */
  }
  return `Request failed (${res.status})`;
}

function redirectOn401(res: Response): void {
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
}

/** Newest-first page of thought records; `before` is the previous page's nextCursor. */
export async function fetchCbtRecords(before?: string): Promise<CbtHistoryResponse> {
  const res = await fetch(before ? `/api/cbt?before=${encodeURIComponent(before)}` : '/api/cbt');
  redirectOn401(res);
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function postCbtRecord(
  payload: CbtRecordPayload,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const res = await fetch('/api/cbt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  redirectOn401(res);
  if (res.status === 201) {
    const { id } = await res.json();
    return { ok: true, id };
  }
  return { ok: false, message: await readError(res) };
}

export async function deleteCbtRecord(id: string): Promise<void> {
  const res = await fetch(`/api/cbt/${id}`, { method: 'DELETE' });
  redirectOn401(res);
  if (!res.ok && res.status !== 404) throw new Error(await readError(res));
}
