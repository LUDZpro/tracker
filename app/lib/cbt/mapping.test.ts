import { describe, expect, it } from 'vitest';
import { cbtTitle, fromCbtNotionPage, toCbtNotionProperties } from './mapping';
import type { CbtRecordPayload } from './types';

const PAYLOAD: CbtRecordPayload = {
  occurred_at: '2026-07-14T02:30:00+01:00',
  trigger: 'A message I read before bed',
  thought: 'This means something is really wrong',
  emotion: 'anxious',
  intensityBefore: 80,
  distortions: ['catastrophizing', 'fortune telling'],
  evidenceFor: ['It was unexpected'],
  evidenceAgainst: ['No actual confirmation', 'Night thoughts exaggerate'],
  reframe: 'I do not know yet — I can find out tomorrow.',
  intensityAfter: 45,
};

/** Notion echo of what toCbtNotionProperties writes, as the API returns it. */
function notionPage(props: Record<string, unknown>): unknown {
  const rt = (v: unknown) => ({
    rich_text: ((v as any)?.rich_text ?? []).map((r: any) => ({
      plain_text: r.text.content,
    })),
  });
  const p = props as any;
  return {
    id: 'page-1',
    properties: {
      Record: { title: [{ plain_text: p.Record.title[0].text.content }] },
      Date: { date: { start: p.Date.date.start } },
      Trigger: rt(p.Trigger),
      Thought: rt(p.Thought),
      Emotion: { select: { name: p.Emotion.select.name } },
      'Intensity Before': { number: p['Intensity Before'].number },
      'Intensity After': { number: p['Intensity After'].number },
      Distortions: { multi_select: p.Distortions.multi_select },
      'Evidence For': rt(p['Evidence For']),
      'Evidence Against': rt(p['Evidence Against']),
      Reframe: rt(p.Reframe),
    },
  };
}

describe('cbtTitle', () => {
  it('uses the trigger verbatim when short', () => {
    expect(cbtTitle({ trigger: 'late night spiral' })).toBe('late night spiral');
  });

  it('truncates long triggers with an ellipsis', () => {
    const title = cbtTitle({ trigger: 'x'.repeat(120) });
    expect(title.length).toBe(60);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('CBT Notion round-trip', () => {
  it('writes and reads back a full record', () => {
    const record = fromCbtNotionPage(notionPage(toCbtNotionProperties(PAYLOAD)));
    expect(record).not.toBeNull();
    expect(record).toMatchObject({
      id: 'page-1',
      occurredAt: PAYLOAD.occurred_at,
      trigger: PAYLOAD.trigger,
      thought: PAYLOAD.thought,
      emotion: 'anxious',
      intensityBefore: 80,
      intensityAfter: 45,
      distortions: PAYLOAD.distortions,
      evidenceFor: PAYLOAD.evidenceFor,
      evidenceAgainst: PAYLOAD.evidenceAgainst,
      reframe: PAYLOAD.reframe,
    });
  });

  it('round-trips empty evidence and no distortions', () => {
    const bare = { ...PAYLOAD, distortions: [], evidenceFor: [], evidenceAgainst: [] };
    const record = fromCbtNotionPage(notionPage(toCbtNotionProperties(bare)));
    expect(record?.distortions).toEqual([]);
    expect(record?.evidenceFor).toEqual([]);
    expect(record?.evidenceAgainst).toEqual([]);
  });

  it('discards foreign multi-select options instead of failing', () => {
    const page = notionPage(toCbtNotionProperties(PAYLOAD)) as any;
    page.properties.Distortions.multi_select.push({ name: 'added by hand in Notion' });
    expect(fromCbtNotionPage(page)?.distortions).toEqual(PAYLOAD.distortions);
  });

  it('rejects archived pages and pages missing core fields', () => {
    const page = notionPage(toCbtNotionProperties(PAYLOAD)) as any;
    expect(fromCbtNotionPage({ ...page, archived: true })).toBeNull();
    const noDate = notionPage(toCbtNotionProperties(PAYLOAD)) as any;
    delete noDate.properties.Date;
    expect(fromCbtNotionPage(noDate)).toBeNull();
    expect(fromCbtNotionPage(null)).toBeNull();
  });
});
