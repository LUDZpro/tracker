import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { clientIp, jsonError, readJson } from '@/lib/http';
import { allowPinAttempt, resetPinAttempts } from '@/lib/rate-limit';
import { SESSION_COOKIE, SESSION_TTL_MS, signSession } from '@/lib/session';

function pinMatches(candidate: string, actual: string): boolean {
  const a = Buffer.from(candidate.padEnd(64, '\0'));
  const b = Buffer.from(actual.padEnd(64, '\0'));
  return a.length === b.length && timingSafeEqual(a, b) && candidate.length === actual.length;
}

export async function POST(req: Request) {
  const pin = process.env.APP_PIN;
  const secret = process.env.SESSION_SECRET;
  if (!pin || !secret) return jsonError(500, 'Server is not configured');

  const ip = clientIp(req);
  if (!allowPinAttempt(ip)) {
    return jsonError(429, 'Too many attempts — try again in an hour');
  }

  const body = (await readJson(req)) as { pin?: unknown } | null;
  const candidate = body?.pin;
  if (typeof candidate !== 'string' || candidate.length === 0 || candidate.length > 32) {
    return jsonError(400, 'PIN required');
  }
  if (!pinMatches(candidate, pin)) {
    return jsonError(401, 'Wrong PIN');
  }

  resetPinAttempts(ip);
  const token = await signSession(secret);
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS / 1000,
    path: '/',
  });
  return res;
}
