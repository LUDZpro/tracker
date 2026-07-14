/**
 * Signed session tokens: "<expiryMillis>.<hmacSha256Hex>".
 * Uses Web Crypto so the same code runs in Node routes and Edge middleware.
 */

export const SESSION_COOKIE = 'fl_session';
// Idle timeout: middleware re-signs the cookie on every authenticated
// request, so this is "7 minutes since last activity", not an absolute cap.
export const SESSION_TTL_MS = 7 * 60 * 1000;

const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function signSession(secret: string, now = Date.now()): Promise<string> {
  const exp = String(now + SESSION_TTL_MS);
  return `${exp}.${await hmacHex(secret, exp)}`;
}

export async function verifySession(
  secret: string,
  token: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < now) return false;
  const expected = await hmacHex(secret, exp);
  if (sig.length !== expected.length) return false;
  // constant-time comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
