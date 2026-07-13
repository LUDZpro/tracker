import {
  CAFFEINE_KINDS,
  CATEGORY_BY_TYPE,
  type AppEvent,
  type CaffeineKind,
  type EventPayload,
  type EventType,
  type ExerciseRow,
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
    case 'meal':
      return `action:meal — ${p.mealName}`;
    case 'gym-session':
      return `action:gym-session — ${p.exercises?.length ?? 0} exercises, ${p.sessionDuration ?? 0}min`;
    default:
      return `${category}:${p.type}`;
  }
}

type NotesSource = Pick<
  EventPayload,
  'type' | 'description' | 'proteinG' | 'calories' | 'exercises'
>;

/** Notes rich_text carries the one field with no dedicated Notion column:
 *  meal's free-form description/macros, or gym's exercises array. Every
 *  other type leaves Notes untouched. Exported so PATCH can rebuild it from
 *  a merged (existing + patched) AppEvent, not just a create-time payload. */
export function buildNotesJson(p: NotesSource): string | null {
  if (p.type === 'meal') {
    if (p.description === undefined && p.proteinG === undefined && p.calories === undefined) {
      return null;
    }
    return JSON.stringify({
      v: 1,
      ...(p.description !== undefined ? { description: p.description } : {}),
      ...(p.proteinG !== undefined ? { proteinG: p.proteinG } : {}),
      ...(p.calories !== undefined ? { calories: p.calories } : {}),
    });
  }
  if (p.type === 'gym-session') {
    return JSON.stringify({ v: 1, exercises: p.exercises ?? [] });
  }
  return null;
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
  // gym-session's minutes reuse the same Notion column nap's duration uses.
  const durationValue = p.type === 'gym-session' ? p.sessionDuration : p.duration;
  if (durationValue !== undefined) props['Duration (min)'] = { number: durationValue };
  if (p.intensity !== undefined) props.Intensity = { number: p.intensity };
  if (p.scope !== undefined) props.Scope = { select: { name: p.scope } };
  const notes = buildNotesJson(p);
  if (notes !== null) props.Notes = { rich_text: [{ text: { content: notes } }] };
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
  const durationRaw = p.properties['Duration (min)']?.number ?? undefined;
  const intensity = p.properties.Intensity?.number ?? undefined;
  // gym-session's minutes read back from the same column nap's duration uses.
  const duration = type === 'gym-session' ? undefined : durationRaw;
  const sessionDuration = type === 'gym-session' ? durationRaw : undefined;

  const title = p.properties.Event?.title?.[0]?.plain_text as string | undefined;

  // Caffeine kind lives only in the title ("intake:caffeine — coffee").
  let kind: CaffeineKind | undefined;
  if (type === 'caffeine') {
    const suffix = title?.split(' — ')[1];
    if (suffix && (CAFFEINE_KINDS as readonly string[]).includes(suffix)) {
      kind = suffix as CaffeineKind;
    }
  }

  // Meal name lives only in the title ("action:meal — Lunch").
  let mealName: string | undefined;
  if (type === 'meal') {
    mealName = title?.split(' — ')[1];
  }

  // description/proteinG/calories (meal) or exercises (gym-session) round-trip
  // through Notes as a JSON envelope; a malformed/foreign value is discarded,
  // never thrown — same philosophy as the caffeine-kind suffix check above.
  let description: string | undefined;
  let proteinG: number | undefined;
  let calories: number | undefined;
  let exercises: ExerciseRow[] | undefined;
  const notesRaw = p.properties.Notes?.rich_text?.[0]?.plain_text as string | undefined;
  if (notesRaw && (type === 'meal' || type === 'gym-session')) {
    try {
      const parsed = JSON.parse(notesRaw);
      if (parsed && typeof parsed === 'object' && parsed.v === 1) {
        if (type === 'meal') {
          if (typeof parsed.description === 'string') description = parsed.description;
          if (typeof parsed.proteinG === 'number') proteinG = parsed.proteinG;
          if (typeof parsed.calories === 'number') calories = parsed.calories;
        } else if (Array.isArray(parsed.exercises)) {
          exercises = parsed.exercises;
        }
      }
    } catch {
      // malformed Notes — treat as absent rather than failing the whole page
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
    ...(mealName ? { mealName } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(proteinG !== undefined ? { proteinG } : {}),
    ...(calories !== undefined ? { calories } : {}),
    ...(typeof sessionDuration === 'number' ? { sessionDuration } : {}),
    ...(exercises !== undefined ? { exercises } : {}),
  };
}
