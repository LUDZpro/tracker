import { NextResponse } from 'next/server';
import { NotionError } from './notion';

export function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

/** Map thrown errors to a client-safe response; never leaks details (§6). */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof NotionError) {
    return jsonError(502, 'Notion is unreachable right now — retry in a moment');
  }
  console.error('Unhandled API error:', e instanceof Error ? e.message : e);
  return jsonError(500, 'Something went wrong — retry in a moment');
}

/** Client IP as forwarded by nginx. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0].trim() : 'local';
}

export async function readJson(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
