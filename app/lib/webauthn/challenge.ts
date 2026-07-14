/**
 * In-memory WebAuthn challenge box: one pending ceremony per kind, 5-minute
 * TTL, consumed on read. Single user + single instance makes this enough —
 * a challenge must never verify twice, and `take` guarantees that.
 */

const TTL_MS = 5 * 60 * 1000;

type Kind = 'register' | 'login';

const box = new Map<Kind, { challenge: string; expires: number }>();

export function saveChallenge(kind: Kind, challenge: string): void {
  box.set(kind, { challenge, expires: Date.now() + TTL_MS });
}

/** Returns the pending challenge once, or null when missing/expired. */
export function takeChallenge(kind: Kind, now = Date.now()): string | null {
  const entry = box.get(kind);
  box.delete(kind);
  if (!entry || entry.expires < now) return null;
  return entry.challenge;
}
