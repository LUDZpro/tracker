/**
 * Fixed-window in-memory rate limiter for the PIN endpoint.
 * nginx already limits 30 API req/min/IP at the edge; this adds the stricter
 * 5 attempts/hour/IP rule for authentication specifically.
 */

interface Window {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const windows = new Map<string, Window>();

export function allowPinAttempt(ip: string, now = Date.now()): boolean {
  const w = windows.get(ip);
  if (!w || now >= w.resetAt) {
    windows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (w.count >= MAX_ATTEMPTS) return false;
  windows.set(ip, { count: w.count + 1, resetAt: w.resetAt });
  return true;
}

/** On successful login, clear the window for that IP. */
export function resetPinAttempts(ip: string): void {
  windows.delete(ip);
}
