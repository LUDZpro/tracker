import { isValidTimestamp } from '../validation';
import {
  CBT_DISTORTIONS,
  CBT_EMOTIONS,
  CBT_MAX_EVIDENCE_ITEMS,
  CBT_TEXT_LIMITS,
  type CbtDistortion,
  type CbtEmotion,
  type CbtRecordPayload,
} from './types';

export type CbtValidationResult =
  | { ok: true; value: CbtRecordPayload }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isEmotion(v: unknown): v is CbtEmotion {
  return typeof v === 'string' && (CBT_EMOTIONS as readonly string[]).includes(v);
}

function isDistortionArray(v: unknown): v is CbtDistortion[] {
  return (
    Array.isArray(v) &&
    v.length <= CBT_DISTORTIONS.length &&
    v.every((d) => (CBT_DISTORTIONS as readonly string[]).includes(d)) &&
    new Set(v).size === v.length
  );
}

function isEvidenceList(v: unknown): v is string[] {
  return (
    Array.isArray(v) &&
    v.length <= CBT_MAX_EVIDENCE_ITEMS &&
    v.every(
      (s) =>
        typeof s === 'string' &&
        s.trim().length > 0 &&
        s.length <= CBT_TEXT_LIMITS.evidenceItem,
    )
  );
}

function isSuds(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100;
}

function requiredText(v: unknown, max: number): v is string {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

/** Validate an untrusted POST /api/cbt body. Unknown extra keys are dropped. */
export function validateCbtPayload(body: unknown, now = new Date()): CbtValidationResult {
  if (!isRecord(body)) return { ok: false, error: 'Body must be a JSON object' };
  if (!isValidTimestamp(body.occurred_at, now)) {
    return { ok: false, error: 'occurred_at must be ISO 8601 with timezone, within 48h of now' };
  }
  if (!requiredText(body.trigger, CBT_TEXT_LIMITS.trigger)) {
    return { ok: false, error: `Trigger is required (max ${CBT_TEXT_LIMITS.trigger} characters)` };
  }
  if (!requiredText(body.thought, CBT_TEXT_LIMITS.thought)) {
    return { ok: false, error: `Thought is required (max ${CBT_TEXT_LIMITS.thought} characters)` };
  }
  if (!isEmotion(body.emotion)) {
    return { ok: false, error: 'Unknown emotion' };
  }
  if (!isSuds(body.intensityBefore) || !isSuds(body.intensityAfter)) {
    return { ok: false, error: 'Intensity must be an integer between 0 and 100' };
  }
  if (!isDistortionArray(body.distortions)) {
    return { ok: false, error: 'Distortions must be a list of known distortions, no repeats' };
  }
  if (!isEvidenceList(body.evidenceFor) || !isEvidenceList(body.evidenceAgainst)) {
    return {
      ok: false,
      error: `Evidence must be up to ${CBT_MAX_EVIDENCE_ITEMS} short facts per side`,
    };
  }
  if (!requiredText(body.reframe, CBT_TEXT_LIMITS.reframe)) {
    return { ok: false, error: `Reframe is required (max ${CBT_TEXT_LIMITS.reframe} characters)` };
  }

  return {
    ok: true,
    value: {
      occurred_at: body.occurred_at,
      trigger: body.trigger.trim(),
      thought: body.thought.trim(),
      emotion: body.emotion,
      intensityBefore: body.intensityBefore,
      distortions: body.distortions,
      evidenceFor: body.evidenceFor.map((s) => s.trim()),
      evidenceAgainst: body.evidenceAgainst.map((s) => s.trim()),
      reframe: body.reframe.trim(),
      intensityAfter: body.intensityAfter,
    },
  };
}
