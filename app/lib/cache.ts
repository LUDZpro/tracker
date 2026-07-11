/**
 * 60s in-memory cache for /api/today. Single-instance deployment, so a
 * module-level slot is sufficient. Every write route calls invalidateToday().
 */

const TTL_MS = 60_000;

interface Slot<T> {
  data: T;
  at: number;
}

let slot: Slot<unknown> | null = null;

export function getCachedToday<T>(now = Date.now()): T | null {
  if (slot && now - slot.at < TTL_MS) return slot.data as T;
  return null;
}

export function setCachedToday<T>(data: T, now = Date.now()): void {
  slot = { data, at: now };
}

export function invalidateToday(): void {
  slot = null;
}
