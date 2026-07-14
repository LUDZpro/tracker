import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_TTL_MS, signSession, verifySession } from '@/lib/session';

const PUBLIC_PATHS = new Set([
  '/login',
  '/api/session',
  '/api/webauthn/status',
  '/api/webauthn/login/options',
  '/api/webauthn/login/verify',
  '/manifest.json',
  '/sw.js',
]);

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname) || pathname.startsWith('/icons/');
}

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

/** Rolling idle timeout: every authenticated request re-signs the cookie,
 *  so the session only dies after SESSION_TTL_MS without any activity. */
async function refreshCookie(res: NextResponse, secret: string): Promise<NextResponse> {
  res.cookies.set(SESSION_COOKIE, await signSession(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS / 1000,
    path: '/',
  });
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');
  const secret = process.env.SESSION_SECRET ?? '';

  let authed = false;
  if (!isPublic(pathname)) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    authed = secret !== '' && (await verifySession(secret, token));
    if (!authed) {
      if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  if (isApi) {
    return authed ? refreshCookie(NextResponse.next(), secret) : NextResponse.next();
  }

  // RSC/prefetch fetches are router data, not documents — mutating their
  // request headers with a fresh nonce makes the client router treat every
  // payload as mismatched and silently drop Link navigations.
  if (req.headers.get('rsc') === '1' || req.headers.get('next-router-prefetch') !== null) {
    return authed ? refreshCookie(NextResponse.next(), secret) : NextResponse.next();
  }

  // Per-request nonce CSP; Next picks the nonce up from the request header.
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const csp = buildCsp(nonce);
  const headers = new Headers(req.headers);
  headers.set('content-security-policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('content-security-policy', csp);
  return authed ? refreshCookie(res, secret) : res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
