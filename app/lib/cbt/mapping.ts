import {
  CBT_DISTORTIONS,
  CBT_EMOTIONS,
  type CbtDistortion,
  type CbtEmotion,
  type CbtRecord,
  type CbtRecordPayload,
} from './types';

const TITLE_MAX = 60;
const EVIDENCE_SEP = '\n';

/** Page title is a trigger snippet — the CBT database is browsed by situation. */
export function cbtTitle(p: Pick<CbtRecordPayload, 'trigger'>): string {
  const t = p.trigger.trim();
  return t.length <= TITLE_MAX ? t : `${t.slice(0, TITLE_MAX - 1)}…`;
}

/** Build the Notion properties object for pages.create in the CBT database. */
export function toCbtNotionProperties(p: CbtRecordPayload): Record<string, unknown> {
  return {
    Record: { title: [{ text: { content: cbtTitle(p) } }] },
    Date: { date: { start: p.occurred_at } },
    Trigger: { rich_text: [{ text: { content: p.trigger } }] },
    Thought: { rich_text: [{ text: { content: p.thought } }] },
    Emotion: { select: { name: p.emotion } },
    'Intensity Before': { number: p.intensityBefore },
    'Intensity After': { number: p.intensityAfter },
    Distortions: { multi_select: p.distortions.map((name) => ({ name })) },
    'Evidence For': {
      rich_text: p.evidenceFor.length > 0
        ? [{ text: { content: p.evidenceFor.join(EVIDENCE_SEP) } }]
        : [],
    },
    'Evidence Against': {
      rich_text: p.evidenceAgainst.length > 0
        ? [{ text: { content: p.evidenceAgainst.join(EVIDENCE_SEP) } }]
        : [],
    },
    Reframe: { rich_text: [{ text: { content: p.reframe } }] },
  };
}

type NotionPage = {
  id: string;
  archived?: boolean;
  in_trash?: boolean;
  properties?: Record<string, any>;
};

function plainText(prop: unknown): string {
  const rt = (prop as any)?.rich_text;
  if (!Array.isArray(rt)) return '';
  return rt.map((r: any) => r?.plain_text ?? '').join('');
}

function splitEvidence(text: string): string[] {
  return text
    .split(EVIDENCE_SEP)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Parse a Notion page back into a CbtRecord; null if it isn't one of ours. */
export function fromCbtNotionPage(page: unknown): CbtRecord | null {
  const p = page as NotionPage;
  if (!p?.id || !p.properties) return null;
  if (p.archived || p.in_trash) return null;

  const occurredAt = p.properties.Date?.date?.start as string | undefined;
  const emotion = p.properties.Emotion?.select?.name as string | undefined;
  const before = p.properties['Intensity Before']?.number;
  const after = p.properties['Intensity After']?.number;
  if (!occurredAt || typeof before !== 'number' || typeof after !== 'number') return null;
  if (!emotion || !(CBT_EMOTIONS as readonly string[]).includes(emotion)) return null;

  const distortionsRaw = p.properties.Distortions?.multi_select;
  const distortions: CbtDistortion[] = Array.isArray(distortionsRaw)
    ? distortionsRaw
        .map((o: any) => o?.name as string)
        .filter((n): n is CbtDistortion => (CBT_DISTORTIONS as readonly string[]).includes(n))
    : [];

  return {
    id: p.id,
    occurredAt,
    trigger: plainText(p.properties.Trigger),
    thought: plainText(p.properties.Thought),
    emotion: emotion as CbtEmotion,
    intensityBefore: before,
    intensityAfter: after,
    distortions,
    evidenceFor: splitEvidence(plainText(p.properties['Evidence For'])),
    evidenceAgainst: splitEvidence(plainText(p.properties['Evidence Against'])),
    reframe: plainText(p.properties.Reframe),
  };
}
