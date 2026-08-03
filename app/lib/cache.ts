/**
 * In-memory caches for the read-heavy GET routes. Single-instance
 * deployment, so module-level state is sufficient — no Redis needed.
 * Every write route calls the matching invalidate* function.
 */
import type { EventType } from './types';

const TTL_MS = 60_000;
const HISTORY_TTL_MS = 30_000;

interface Slot<T> {
  data: T;
  at: number;
}

let todaySlot: Slot<unknown> | null = null;

export function getCachedToday<T>(now = Date.now()): T | null {
  if (todaySlot && now - todaySlot.at < TTL_MS) return todaySlot.data as T;
  return null;
}

export function setCachedToday<T>(data: T, now = Date.now()): void {
  todaySlot = { data, at: now };
}

// Week (desktop 7-day column): derived from the same event log as today,
// so the two slots always invalidate together — every write route already
// calls invalidateToday(), and week must never outlive it.
let weekSlot: Slot<unknown> | null = null;

export function getCachedWeek<T>(now = Date.now()): T | null {
  if (weekSlot && now - weekSlot.at < TTL_MS) return weekSlot.data as T;
  return null;
}

export function setCachedWeek<T>(data: T, now = Date.now()): void {
  weekSlot = { data, at: now };
}

// Report (clinical export): the entire event log. Expensive to build and
// read rarely, so it gets a longer TTL — but it is derived from the same
// log as today/week, so it must die with them on every write.
const REPORT_TTL_MS = 300_000;
let reportSlot: Slot<unknown> | null = null;

export function getCachedReport<T>(now = Date.now()): T | null {
  if (reportSlot && now - reportSlot.at < REPORT_TTL_MS) return reportSlot.data as T;
  return null;
}

export function setCachedReport<T>(data: T, now = Date.now()): void {
  reportSlot = { data, at: now };
}

export function invalidateToday(): void {
  todaySlot = null;
  weekSlot = null;
  reportSlot = null;
}

// Recipes: the pre-planned meal list, edited in Notion and read on every
// nutrition surface. Changes rarely, so a longer TTL and no invalidation —
// a stale recipe list self-heals within RECIPES_TTL_MS.
const RECIPES_TTL_MS = 300_000;
let recipesSlot: Slot<unknown> | null = null;

export function getCachedRecipes<T>(now = Date.now()): T | null {
  if (recipesSlot && now - recipesSlot.at < RECIPES_TTL_MS) return recipesSlot.data as T;
  return null;
}

export function setCachedRecipes<T>(data: T, now = Date.now()): void {
  recipesSlot = { data, at: now };
}

// History (Nutrition/Gym): only the first page (no `before` cursor) is
// cached — scrolled-further pages are one-shot fetches the user explicitly
// asked for, not worth caching.
const historySlots = new Map<EventType, Slot<unknown>>();

export function getCachedHistory<T>(type: EventType, now = Date.now()): T | null {
  const s = historySlots.get(type);
  if (s && now - s.at < HISTORY_TTL_MS) return s.data as T;
  return null;
}

export function setCachedHistory<T>(type: EventType, data: T, now = Date.now()): void {
  historySlots.set(type, { data, at: now });
}

export function invalidateHistory(type: EventType): void {
  historySlots.delete(type);
}
