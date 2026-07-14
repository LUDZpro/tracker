import { notionFetch } from '../notion';
import { fromCbtNotionPage, toCbtNotionProperties } from './mapping';
import type { CbtRecord, CbtRecordPayload } from './types';

/**
 * The CBT thought-records data source — a database of its own, deliberately
 * separate from the event log (created 2026-07-14 under the same parent page
 * so the integration token has access to both).
 */
const CBT_DATA_SOURCE_ID = '5b558363-0e9f-4708-9436-922146d173d9';

/** Create one thought-record page; returns the new page id. */
export async function createCbtRecord(payload: CbtRecordPayload): Promise<string> {
  const body = {
    parent: { type: 'data_source_id', data_source_id: CBT_DATA_SOURCE_ID },
    properties: toCbtNotionProperties(payload),
  };
  const page = await notionFetch('/pages', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return page.id as string;
}

/** Newest-first page of thought records; `before` is a plain ISO timestamp
 *  (the previous page's oldest record), same cursor style as /api/history. */
export async function queryCbtRecords(opts: {
  before?: string;
  limit: number;
}): Promise<{ records: CbtRecord[]; hasMore: boolean }> {
  const body: Record<string, unknown> = {
    ...(opts.before
      ? { filter: { property: 'Date', date: { before: opts.before } } }
      : {}),
    sorts: [{ property: 'Date', direction: 'descending' }],
    page_size: opts.limit,
  };
  const data = await notionFetch(`/data_sources/${CBT_DATA_SOURCE_ID}/query`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const records: CbtRecord[] = [];
  for (const page of data.results ?? []) {
    const r = fromCbtNotionPage(page);
    if (r) records.push(r);
  }
  return { records, hasMore: Boolean(data.has_more) };
}

/** Archive (soft-delete) a thought record — reversible in Notion. */
export async function archiveCbtRecord(id: string): Promise<void> {
  await notionFetch(`/pages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true }),
  });
}
