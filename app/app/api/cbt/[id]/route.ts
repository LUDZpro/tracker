import { NextResponse } from 'next/server';
import { archiveCbtRecord } from '@/lib/cbt/notion';
import { errorResponse } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

/** Archive (soft-delete) a thought record — reversible in Notion. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    await archiveCbtRecord(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
