/**
 * CBT thought records — a deliberately separate domain from the event log.
 * Model: Beck-style 7-column thought record (trigger → automatic thought →
 * emotion + SUDS intensity → cognitive distortions → evidence for/against →
 * balanced reframe → re-rated intensity).
 */

export type CbtEmotion =
  | 'anxious'
  | 'sad'
  | 'angry'
  | 'ashamed'
  | 'guilty'
  | 'overwhelmed'
  | 'hopeless';

export const CBT_EMOTIONS: readonly CbtEmotion[] = [
  'anxious',
  'sad',
  'angry',
  'ashamed',
  'guilty',
  'overwhelmed',
  'hopeless',
];

export type CbtDistortion =
  | 'catastrophizing'
  | 'all-or-nothing'
  | 'mind reading'
  | 'fortune telling'
  | 'emotional reasoning'
  | 'overgeneralization'
  | 'mental filter'
  | 'discounting positives'
  | 'should statements'
  | 'labeling'
  | 'personalization';

export const CBT_DISTORTIONS: readonly CbtDistortion[] = [
  'catastrophizing',
  'all-or-nothing',
  'mind reading',
  'fortune telling',
  'emotional reasoning',
  'overgeneralization',
  'mental filter',
  'discounting positives',
  'should statements',
  'labeling',
  'personalization',
];

export const CBT_TEXT_LIMITS = {
  trigger: 200,
  thought: 500,
  reframe: 500,
  evidenceItem: 200,
} as const;

export const CBT_MAX_EVIDENCE_ITEMS = 10;

/** Payload accepted by POST /api/cbt (client → server). */
export interface CbtRecordPayload {
  occurred_at: string; // ISO 8601 with timezone offset
  trigger: string;
  thought: string;
  emotion: CbtEmotion;
  intensityBefore: number; // 0–100 SUDS
  distortions: CbtDistortion[];
  evidenceFor: string[]; // facts supporting the hot thought
  evidenceAgainst: string[]; // facts against it
  reframe: string; // balanced thought
  intensityAfter: number; // 0–100, re-rated after the exercise
}

/** A thought record as read back from the CBT database. */
export interface CbtRecord {
  id: string;
  occurredAt: string;
  trigger: string;
  thought: string;
  emotion: CbtEmotion;
  intensityBefore: number;
  distortions: CbtDistortion[];
  evidenceFor: string[];
  evidenceAgainst: string[];
  reframe: string;
  intensityAfter: number;
}

/** Response shape for GET /api/cbt (ISO-cursor paged, newest first). */
export interface CbtHistoryResponse {
  records: CbtRecord[];
  nextCursor: string | null;
}
