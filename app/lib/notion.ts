import { fromNotionPage, toNotionProperties } from './mapping';
import type { AppEvent, EventPayload } from './types';

/**
 * The ONLY Notion data source this app may write to (event log).
 * The archived legacy DB (759ed533-…) must never be referenced here.
 */
const DATA_SOURCE_ID = '59f692c3-e817-4893-ad70-0134b9bb1ff2';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2025-09-03';

export class NotionError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'NotionError';
  }
}

function token(): string {
  const t = process.env.NOTION_TOKEN;
  if (!t) throw new NotionError(500, 'NOTION_TOKEN is not configured');
  return t;
}

async function notionFetch(path: string, init: RequestInit): Promise<any> {
  const res = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) {
    // Notion error bodies can echo request content — log status only (§6).
    console.error(`Notion API ${init.method ?? 'GET'} ${path} → ${res.status}`);
    throw new NotionError(res.status, `Notion request failed (${res.status})`);
  }
  return res.json();
}

/** Create one event page; returns the new page id. */
export async function createEvent(payload: EventPayload): Promise<string> {
  const body = {
    parent: { type: 'data_source_id', data_source_id: DATA_SOURCE_ID },
    properties: toNotionProperties(payload),
  };
  const page = await notionFetch('/pages', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return page.id as string;
}

/** Update editable fields on an existing event; `title` keeps the write
 *  contract's "category:type — value" line in step with value edits. */
export async function updateEventFields(
  id: string,
  patch: {
    occurredAt?: string;
    precision?: string;
    duration?: number;
    intensity?: number;
    title?: string;
  },
): Promise<void> {
  const properties: Record<string, unknown> = {};
  if (patch.occurredAt) properties['Occurred at'] = { date: { start: patch.occurredAt } };
  if (patch.precision) properties.Precision = { select: { name: patch.precision } };
  if (patch.duration !== undefined) properties['Duration (min)'] = { number: patch.duration };
  if (patch.intensity !== undefined) properties.Intensity = { number: patch.intensity };
  if (patch.title) properties.Event = { title: [{ text: { content: patch.title } }] };
  await notionFetch(`/pages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
}

/** Archive (soft-delete) an event page. */
export async function archiveEvent(id: string): Promise<void> {
  await notionFetch(`/pages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true }),
  });
}

/** Retrieve a single event; null when missing or not one of ours. */
export async function retrieveEvent(id: string): Promise<AppEvent | null> {
  try {
    const page = await notionFetch(`/pages/${id}`, { method: 'GET' });
    return fromNotionPage(page);
  } catch (e) {
    if (e instanceof NotionError && e.status === 404) return null;
    throw e;
  }
}

/** All events with Occurred at ≥ sinceIso, oldest first. Paginates. */
export async function queryEventsSince(sinceIso: string): Promise<AppEvent[]> {
  const events: AppEvent[] = [];
  let cursor: string | undefined;
  do {
    const body: Record<string, unknown> = {
      filter: {
        property: 'Occurred at',
        date: { on_or_after: sinceIso },
      },
      sorts: [{ property: 'Occurred at', direction: 'ascending' }],
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    };
    const data = await notionFetch(`/data_sources/${DATA_SOURCE_ID}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    for (const page of data.results ?? []) {
      const ev = fromNotionPage(page);
      if (ev) events.push(ev);
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return events;
}
