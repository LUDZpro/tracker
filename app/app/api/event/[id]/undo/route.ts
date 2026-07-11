import { NextResponse } from 'next/server';
import { invalidateToday } from '@/lib/cache';
import { errorResponse } from '@/lib/http';
import { archiveEvent } from '@/lib/notion';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await archiveEvent(id);
    invalidateToday();
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
