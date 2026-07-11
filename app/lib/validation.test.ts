import { describe, expect, it } from 'vitest';
import { patchMismatch, validateEventPayload, validatePatchBody } from './validation';

const NOW = new Date('2026-07-06T12:00:00+01:00');
const AT = '2026-07-06T11:30:00+01:00';

describe('validateEventPayload', () => {
  it('accepts a plain wake marker', () => {
    const r = validateEventPayload({ type: 'wake_up', occurred_at: AT, precision: 'exact' }, NOW);
    expect(r).toEqual({ ok: true, value: { type: 'wake_up', occurred_at: AT, precision: 'exact' } });
  });

  it('rejects unknown types', () => {
    const r = validateEventPayload({ type: 'teleport', occurred_at: AT, precision: 'exact' }, NOW);
    expect(r.ok).toBe(false);
  });

  it('rejects timestamps without timezone', () => {
    const r = validateEventPayload(
      { type: 'wake_up', occurred_at: '2026-07-06T11:30:00', precision: 'exact' },
      NOW,
    );
    expect(r.ok).toBe(false);
  });

  it('rejects timestamps beyond ±48h of server time', () => {
    const r = validateEventPayload(
      { type: 'wake_up', occurred_at: '2026-07-01T11:30:00+01:00', precision: 'exact' },
      NOW,
    );
    expect(r.ok).toBe(false);
  });

  it('requires nap duration in 1–600', () => {
    const bad = validateEventPayload({ type: 'nap', occurred_at: AT, precision: 'exact', duration: 601 }, NOW);
    expect(bad.ok).toBe(false);
    const good = validateEventPayload({ type: 'nap', occurred_at: AT, precision: 'exact', duration: 45 }, NOW);
    expect(good.ok).toBe(true);
  });

  it('requires caffeine kind from the chip list', () => {
    const bad = validateEventPayload({ type: 'caffeine', occurred_at: AT, precision: 'exact', kind: 'soda' }, NOW);
    expect(bad.ok).toBe(false);
    const good = validateEventPayload({ type: 'caffeine', occurred_at: AT, precision: 'exact', kind: 'tea' }, NOW);
    expect(good.ok).toBe(true);
  });

  it('bounds mood intensity to 1–5 and defaults scope to momentary', () => {
    const bad = validateEventPayload({ type: 'mood', occurred_at: AT, precision: 'exact', intensity: 6 }, NOW);
    expect(bad.ok).toBe(false);
    const good = validateEventPayload({ type: 'energy', occurred_at: AT, precision: 'exact', intensity: 3 }, NOW);
    expect(good.ok && good.value.scope).toBe('momentary');
  });

  it('drops unknown extra keys such as client_tag', () => {
    const r = validateEventPayload(
      { type: 'wake_up', occurred_at: AT, precision: 'exact', client_tag: 'abc' },
      NOW,
    );
    expect(r.ok && 'client_tag' in r.value).toBe(false);
  });
});

describe('validatePatchBody', () => {
  it('accepts any subset of the editable fields', () => {
    const r = validatePatchBody({ occurred_at: AT, kind: 'tea' }, NOW);
    expect(r).toEqual({ ok: true, value: { occurred_at: AT, kind: 'tea' } });
    expect(validatePatchBody({ intensity: 4 }, NOW).ok).toBe(true);
    expect(validatePatchBody({ duration: 45 }, NOW).ok).toBe(true);
  });

  it('rejects an empty or fieldless body', () => {
    expect(validatePatchBody({}, NOW).ok).toBe(false);
    expect(validatePatchBody({ client_tag: 'abc' }, NOW).ok).toBe(false);
    expect(validatePatchBody(null, NOW).ok).toBe(false);
  });

  it('applies the same bounds as create', () => {
    expect(validatePatchBody({ intensity: 6 }, NOW).ok).toBe(false);
    expect(validatePatchBody({ duration: 601 }, NOW).ok).toBe(false);
    expect(validatePatchBody({ kind: 'soda' }, NOW).ok).toBe(false);
    expect(validatePatchBody({ occurred_at: '2026-07-01T11:30:00+01:00' }, NOW).ok).toBe(false);
  });
});

describe('patchMismatch', () => {
  it('blocks value fields on the wrong event type', () => {
    expect(patchMismatch('wake_up', { kind: 'tea' })).toMatch(/caffeine/);
    expect(patchMismatch('caffeine', { intensity: 3 })).toMatch(/mood/);
    expect(patchMismatch('mood', { duration: 20 })).toMatch(/nap/);
  });

  it('allows matching fields and pure timing edits', () => {
    expect(patchMismatch('caffeine', { kind: 'tea' })).toBeNull();
    expect(patchMismatch('mood', { intensity: 5 })).toBeNull();
    expect(patchMismatch('nap', { duration: 90 })).toBeNull();
    expect(patchMismatch('sleep_start', { occurred_at: AT, precision: '~5min' })).toBeNull();
  });
});
