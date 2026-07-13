import type { AppEvent, EventType } from '@/lib/types';

/**
 * Module-level (not persisted) cache of loaded history pages per tracker.
 * Survives component unmount/remount within a session, so switching
 * Nutrition → Gym → Nutrition paints instantly instead of reloading. A full
 * page reload starts fresh — same staleness profile as /api/today.
 */
export interface CachedPage {
  events: AppEvent[];
  nextCursor: string | null;
}

const cache = new Map<EventType, CachedPage[]>();

export function getCachedHistory(type: EventType): CachedPage[] | null {
  return cache.get(type) ?? null;
}

export function setCachedHistory(type: EventType, pages: CachedPage[]): void {
  cache.set(type, pages);
}

export function invalidateHistory(type: EventType): void {
  cache.delete(type);
}
