import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/http';
import { listSubstances } from '@/lib/substances/registry';

/** The quick-log grid's tile list. Static per process — the registry is a
 *  file, not a table, so there is nothing to invalidate on write. */
export async function GET() {
  try {
    return NextResponse.json({ substances: await listSubstances() });
  } catch (e) {
    return errorResponse(e);
  }
}
