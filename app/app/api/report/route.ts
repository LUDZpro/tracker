import { NextResponse } from 'next/server';
import { getCachedReport, setCachedReport } from '@/lib/cache';
import { errorResponse } from '@/lib/http';
import { queryAllEvents } from '@/lib/store/events';
import { toLocalISO } from '@/lib/time';
import type { AppEvent } from '@/lib/types';

export interface ReportResponse {
  now: string;
  events: AppEvent[];
}

/**
 * The complete event log for the clinical report.
 *
 * Unlike /api/today and /api/week this is not a window — the report exists
 * to show the whole record, gaps included. No `editable` flag is attached:
 * the report is read-only by construction.
 */
export async function GET() {
  const cached = getCachedReport<ReportResponse>();
  if (cached) {
    return NextResponse.json({ ...cached, now: toLocalISO(new Date()) });
  }

  try {
    const events = await queryAllEvents();
    const payload: ReportResponse = { now: toLocalISO(new Date()), events };
    setCachedReport(payload);
    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
