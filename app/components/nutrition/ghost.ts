import { CATEGORY_BY_TYPE, type AppEvent, type EventPayload } from '@/lib/types';

/** Optimistic row shown until the next history refresh lands. Shared by the
 *  mobile nutrition page and the desktop console. */
export function ghostEvent(payload: EventPayload): AppEvent {
  return buildGhost(payload);
}

/**
 * Drop only the ghosts whose real row has landed in a history refresh.
 * Notion's query-after-create can lag a beat, so the refresh fired right
 * after a log often comes back WITHOUT the new event — clearing all ghosts
 * there makes the row vanish until the next refocus. Matching on meal name +
 * wall-minute keeps the ghost alive exactly until its real row shows up.
 */
export function clearLandedGhosts(
  ghosts: AppEvent[],
  events: readonly AppEvent[],
): AppEvent[] {
  const next = ghosts.filter(
    (g) =>
      !events.some(
        (e) =>
          e.mealName === g.mealName && e.occurredAt.slice(0, 16) === g.occurredAt.slice(0, 16),
      ),
  );
  return next.length === ghosts.length ? ghosts : next;
}

function buildGhost(payload: EventPayload): AppEvent {
  return {
    id: `ghost-${crypto.randomUUID()}`,
    type: payload.type,
    category: CATEGORY_BY_TYPE[payload.type],
    occurredAt: payload.occurred_at,
    precision: payload.precision,
    ...(payload.mealName !== undefined ? { mealName: payload.mealName } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.proteinG !== undefined ? { proteinG: payload.proteinG } : {}),
    ...(payload.calories !== undefined ? { calories: payload.calories } : {}),
    editable: false, // resolves to a real, tappable row on refresh
  };
}
