import { describe, expect, it } from 'vitest';
import { validateCbtPayload } from './validation';

const NOW = new Date('2026-07-14T12:00:00+01:00');

function valid(): Record<string, unknown> {
  return {
    occurred_at: '2026-07-14T02:30:00+01:00',
    trigger: 'A message I read before bed',
    thought: 'This means something is really wrong',
    emotion: 'anxious',
    intensityBefore: 80,
    distortions: ['catastrophizing', 'fortune telling'],
    evidenceFor: ['It was unexpected'],
    evidenceAgainst: ['No actual confirmation', 'I always assume the worst at night'],
    reframe: 'I do not actually know yet — I can find out tomorrow instead of guessing.',
    intensityAfter: 45,
  };
}

describe('validateCbtPayload', () => {
  it('accepts a complete record and trims text fields', () => {
    const body = { ...valid(), trigger: '  late night spiral  ' };
    const res = validateCbtPayload(body, NOW);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.trigger).toBe('late night spiral');
      expect(res.value.distortions).toEqual(['catastrophizing', 'fortune telling']);
    }
  });

  it('drops unknown extra keys', () => {
    const res = validateCbtPayload({ ...valid(), client_tag: 'x' }, NOW);
    expect(res.ok).toBe(true);
    if (res.ok) expect('client_tag' in res.value).toBe(false);
  });

  it('rejects non-object bodies', () => {
    expect(validateCbtPayload(null, NOW).ok).toBe(false);
    expect(validateCbtPayload([], NOW).ok).toBe(false);
  });

  it('rejects a missing or empty trigger/thought/reframe', () => {
    expect(validateCbtPayload({ ...valid(), trigger: '   ' }, NOW).ok).toBe(false);
    expect(validateCbtPayload({ ...valid(), thought: '' }, NOW).ok).toBe(false);
    expect(validateCbtPayload({ ...valid(), reframe: undefined }, NOW).ok).toBe(false);
  });

  it('rejects over-length text', () => {
    expect(validateCbtPayload({ ...valid(), trigger: 'x'.repeat(201) }, NOW).ok).toBe(false);
    expect(validateCbtPayload({ ...valid(), thought: 'x'.repeat(501) }, NOW).ok).toBe(false);
  });

  it('rejects unknown emotions and distortions', () => {
    expect(validateCbtPayload({ ...valid(), emotion: 'hangry' }, NOW).ok).toBe(false);
    expect(validateCbtPayload({ ...valid(), distortions: ['doom'] }, NOW).ok).toBe(false);
  });

  it('rejects duplicate distortions', () => {
    const res = validateCbtPayload(
      { ...valid(), distortions: ['labeling', 'labeling'] },
      NOW,
    );
    expect(res.ok).toBe(false);
  });

  it('accepts an empty distortion list and empty evidence', () => {
    const res = validateCbtPayload(
      { ...valid(), distortions: [], evidenceFor: [], evidenceAgainst: [] },
      NOW,
    );
    expect(res.ok).toBe(true);
  });

  it('rejects out-of-range SUDS intensities', () => {
    expect(validateCbtPayload({ ...valid(), intensityBefore: -1 }, NOW).ok).toBe(false);
    expect(validateCbtPayload({ ...valid(), intensityAfter: 101 }, NOW).ok).toBe(false);
    expect(validateCbtPayload({ ...valid(), intensityBefore: 5.5 }, NOW).ok).toBe(false);
  });

  it('rejects too many or blank evidence items', () => {
    expect(
      validateCbtPayload({ ...valid(), evidenceFor: Array(11).fill('fact') }, NOW).ok,
    ).toBe(false);
    expect(validateCbtPayload({ ...valid(), evidenceAgainst: ['  '] }, NOW).ok).toBe(false);
  });

  it('rejects timestamps without timezone or outside the 48h window', () => {
    expect(validateCbtPayload({ ...valid(), occurred_at: '2026-07-14T02:30:00' }, NOW).ok).toBe(
      false,
    );
    expect(
      validateCbtPayload({ ...valid(), occurred_at: '2026-07-01T02:30:00+01:00' }, NOW).ok,
    ).toBe(false);
  });
});
