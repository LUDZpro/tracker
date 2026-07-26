import { NextResponse } from 'next/server';
import { invalidateHistory, invalidateToday } from '@/lib/cache';
import { errorResponse } from '@/lib/http';
import { archiveEvent, retrieveEvent } from '@/lib/store/events';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const ev = await retrieveEvent(id); // read type before archiving flips it invisible
    await archiveEvent(id);
    invalidateToday();
    if (ev) invalidateHistory(ev.type);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
