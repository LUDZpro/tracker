import { CATEGORY_BY_TYPE, type AppEvent, type EventPayload } from '@/lib/types';

/** Optimistic dose row, shown until its real row lands. */
export function ghostEvent(payload: EventPayload): AppEvent {
  return {
    id: `ghost-${crypto.randomUUID()}`,
    type: payload.type,
    category: CATEGORY_BY_TYPE[payload.type],
    occurredAt: payload.occurred_at,
    precision: payload.precision,
    ...(payload.substance !== undefined ? { substance: payload.substance } : {}),
    ...(payload.dose !== undefined ? { dose: payload.dose } : {}),
    ...(payload.note !== undefined ? { note: payload.note } : {}),
    editable: false, // resolves to a real, tappable row on refresh
  };
}

/**
 * Drop only the ghosts whose real row has landed.
 *
 * The same rule nutrition learned the hard way, and it matters more here: a
 * dose logged offline sits in the service worker's queue with no server row
 * at all, so a blanket clear on refresh would erase the pending dose from the
 * strip — and this strip exists specifically to stop a second dose being
 * taken. Matching on substance + wall-minute keeps each ghost alive exactly
 * until its own row appears.
 */
export function clearLandedGhosts(
  ghosts: readonly AppEvent[],
  events: readonly AppEvent[],
): AppEvent[] {
  const next = ghosts.filter(
    (g) =>
      !events.some(
        (e) =>
          e.type === 'supplement' &&
          e.substance === g.substance &&
          e.occurredAt.slice(0, 16) === g.occurredAt.slice(0, 16),
      ),
  );
  // Preserve identity when nothing changed, so the effect can't loop.
  return next.length === ghosts.length ? (ghosts as AppEvent[]) : next;
}
