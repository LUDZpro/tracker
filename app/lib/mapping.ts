import {
  CAFFEINE_KINDS,
  CATEGORY_BY_TYPE,
  type AppEvent,
  type CaffeineKind,
  type EventPayload,
  type EventType,
  type Precision,
} from './types';

/** Title per the write contract, e.g. "intake:caffeine — coffee".
 *  Accepts a payload (create) or a merged AppEvent (PATCH title rewrite). */
export function eventTitle(p: EventPayload | AppEvent): string {
  const category = CATEGORY_BY_TYPE[p.type];
  switch (p.type) {
    case 'nap':
      return `action:nap — ${p.duration}min`;
    case 'caffeine':
      return `intake:caffeine — ${p.kind}`;
    case 'mood':
    case 'energy':
      return `state:${p.type} — ${p.intensity}/5`;
    default:
      return `${category}:${p.type}`;
  }
}

/** Build the Notion properties object for pages.create. */
export function toNotionProperties(p: EventPayload): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Event: { title: [{ text: { content: eventTitle(p) } }] },
    'Occurred at': { date: { start: p.occurred_at } },
    Precision: { select: { name: p.precision } },
    Category: { select: { name: CATEGORY_BY_TYPE[p.type] } },
    // Type is rich_text in the live data source, not select
    Type: { rich_text: [{ text: { content: p.type } }] },
  };
  if (p.duration !== undefined) props['Duration (min)'] = { number: p.duration };
  if (p.intensity !== undefined) props.Intensity = { number: p.intensity };
  if (p.scope !== undefined) props.Scope = { select: { name: p.scope } };
  return props;
}

type NotionPage = {
  id: string;
  archived?: boolean;
  in_trash?: boolean;
  properties?: Record<string, any>;
};

/** Parse a Notion page back into an AppEvent; null if it isn't one of ours. */
export function fromNotionPage(page: unknown): AppEvent | null {
  const p = page as NotionPage;
  if (!p?.id || !p.properties) return null;
  if (p.archived || p.in_trash) return null;

  const type = (p.properties.Type?.rich_text?.[0]?.plain_text ??
    p.properties.Type?.select?.name) as EventType | undefined;
  const occurredAt = p.properties['Occurred at']?.date?.start as string | undefined;
  if (!type || !(type in CATEGORY_BY_TYPE) || !occurredAt) return null;

  const precision = (p.properties.Precision?.select?.name as Precision) ?? 'exact';
  const duration = p.properties['Duration (min)']?.number ?? undefined;
  const intensity = p.properties.Intensity?.number ?? undefined;

  // Caffeine kind lives only in the title ("intake:caffeine — coffee").
  let kind: CaffeineKind | undefined;
  if (type === 'caffeine') {
    const title = p.properties.Event?.title?.[0]?.plain_text as string | undefined;
    const suffix = title?.split(' — ')[1];
    if (suffix && (CAFFEINE_KINDS as readonly string[]).includes(suffix)) {
      kind = suffix as CaffeineKind;
    }
  }

  return {
    id: p.id,
    type,
    category: CATEGORY_BY_TYPE[type],
    occurredAt,
    precision,
    ...(typeof duration === 'number' ? { duration } : {}),
    ...(typeof intensity === 'number' ? { intensity } : {}),
    ...(kind ? { kind } : {}),
  };
}
