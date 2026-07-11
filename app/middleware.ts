import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

const PUBLIC_PATHS = new Set(['/login', '/api/session', '/manifest.json', '/sw.js']);

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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  if (!isPublic(pathname)) {
    const secret = process.env.SESSION_SECRET ?? '';
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const authed = secret !== '' && (await verifySession(secret, token));
    if (!authed) {
      if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  if (isApi) return NextResponse.next();

  // Per-request nonce CSP; Next picks the nonce up from the request header.
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const csp = buildCsp(nonce);
  const headers = new Headers(req.headers);
  headers.set('content-security-policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('content-security-policy', csp);
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
