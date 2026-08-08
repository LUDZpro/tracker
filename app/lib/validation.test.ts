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

  it('requires a meal name 1–60 chars, optional description/macros', () => {
    const missing = validateEventPayload({ type: 'meal', occurred_at: AT, precision: 'exact' }, NOW);
    expect(missing.ok).toBe(false);
    const blank = validateEventPayload(
      { type: 'meal', occurred_at: AT, precision: 'exact', mealName: '  ' },
      NOW,
    );
    expect(blank.ok).toBe(false);
    const minimal = validateEventPayload(
      { type: 'meal', occurred_at: AT, precision: 'exact', mealName: 'Lunch' },
      NOW,
    );
    expect(minimal).toEqual({
      ok: true,
      value: { type: 'meal', occurred_at: AT, precision: 'exact', mealName: 'Lunch' },
    });
    const full = validateEventPayload(
      {
        type: 'meal',
        occurred_at: AT,
        precision: 'exact',
        mealName: 'Lunch',
        description: 'chicken + rice',
        proteinG: 25,
        calories: 450,
      },
      NOW,
    );
    expect(full.ok && full.value.proteinG).toBe(25);
    expect(
      validateEventPayload(
        { type: 'meal', occurred_at: AT, precision: 'exact', mealName: 'Lunch', proteinG: 501 },
        NOW,
      ).ok,
    ).toBe(false);
    expect(
      validateEventPayload(
        { type: 'meal', occurred_at: AT, precision: 'exact', mealName: 'Lunch', calories: -1 },
        NOW,
      ).ok,
    ).toBe(false);
  });

  it('allows a gym session with zero exercises and bounds sessionDuration to 5–600', () => {
    const bare = validateEventPayload({ type: 'gym-session', occurred_at: AT, precision: 'exact' }, NOW);
    expect(bare).toEqual({ ok: true, value: { type: 'gym-session', occurred_at: AT, precision: 'exact' } });
    expect(
      validateEventPayload(
        { type: 'gym-session', occurred_at: AT, precision: 'exact', sessionDuration: 4 },
        NOW,
      ).ok,
    ).toBe(false);
    const full = validateEventPayload(
      {
        type: 'gym-session',
        occurred_at: AT,
        precision: 'exact',
        sessionDuration: 45,
        exercises: [
          { name: 'Bench press', sets: 5, weight: 80, unit: 'kg' },
          { name: 'Squats' }, // minimal row: name only is valid
        ],
      },
      NOW,
    );
    expect(full.ok && full.value.exercises).toHaveLength(2);
  });

  it('rejects a malformed exercise row rather than silently dropping it', () => {
    const badUnit = validateEventPayload(
      {
        type: 'gym-session',
        occurred_at: AT,
        precision: 'exact',
        exercises: [{ name: 'Curls', weight: 20, unit: 'stone' }],
      },
      NOW,
    );
    expect(badUnit.ok).toBe(false);
    const badSets = validateEventPayload(
      { type: 'gym-session', occurred_at: AT, precision: 'exact', exercises: [{ sets: 0 }] },
      NOW,
    );
    expect(badSets.ok).toBe(false);
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

  it('accepts meal and gym-session fields independently', () => {
    expect(validatePatchBody({ proteinG: 30 }, NOW)).toEqual({ ok: true, value: { proteinG: 30 } });
    expect(validatePatchBody({ mealName: '' }, NOW).ok).toBe(false);
    expect(validatePatchBody({ sessionDuration: 3 }, NOW).ok).toBe(false);
    expect(
      validatePatchBody({ exercises: [{ name: 'Rows', sets: 4, weight: 70, unit: 'kg' }] }, NOW).ok,
    ).toBe(true);
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

  it('blocks meal/gym-session fields on the wrong type', () => {
    expect(patchMismatch('nap', { mealName: 'Lunch' })).toMatch(/meal/);
    expect(patchMismatch('meal', { sessionDuration: 45 })).toMatch(/gym-session/);
    expect(patchMismatch('meal', { proteinG: 20 })).toBeNull();
    expect(patchMismatch('gym-session', { exercises: [] })).toBeNull();
  });
});

describe('supplement events', () => {
  const base = { type: 'supplement', occurred_at: AT, precision: 'exact' };

  it('accepts a tap-logged dose', () => {
    const r = validateEventPayload({ ...base, substance: 'melatonin', dose: '1.9 mg' }, NOW);
    expect(r).toEqual({
      ok: true,
      value: { ...base, substance: 'melatonin', dose: '1.9 mg' },
    });
  });

  it('accepts a substance with no dose recorded yet', () => {
    const r = validateEventPayload({ ...base, substance: 'vitamin_d3' }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.dose).toBeUndefined();
  });

  it('requires a substance', () => {
    expect(validateEventPayload(base, NOW).ok).toBe(false);
  });

  it('rejects a substance id that is not a slug', () => {
    for (const substance of ['Melatonin', 'mela tonin', '', 'x'.repeat(41), 5]) {
      expect(validateEventPayload({ ...base, substance }, NOW).ok).toBe(false);
    }
  });

  it('trims the dose and drops a blank one', () => {
    const r = validateEventPayload({ ...base, substance: 'melatonin', dose: '  25 mg ' }, NOW);
    expect(r.ok && r.value.dose).toBe('25 mg');
    const blank = validateEventPayload({ ...base, substance: 'melatonin', dose: '   ' }, NOW);
    expect(blank.ok && blank.value.dose).toBeUndefined();
  });

  it('rejects an overlong dose or note', () => {
    expect(
      validateEventPayload({ ...base, substance: 'melatonin', dose: 'm'.repeat(41) }, NOW).ok,
    ).toBe(false);
    expect(
      validateEventPayload({ ...base, substance: 'melatonin', note: 'n'.repeat(501) }, NOW).ok,
    ).toBe(false);
  });

  it('keeps a note', () => {
    const r = validateEventPayload(
      { ...base, substance: 'hydroxyzine', dose: '25 mg', note: 'half a tablet' },
      NOW,
    );
    expect(r.ok && r.value.note).toBe('half a tablet');
  });

  it('patches substance, dose and note', () => {
    const r = validatePatchBody({ substance: 'magnesium', dose: '400 mg', note: 'double' });
    expect(r).toEqual({
      ok: true,
      value: { substance: 'magnesium', dose: '400 mg', note: 'double' },
    });
  });

  it('lets an emptied dose clear the column instead of being ignored', () => {
    const r = validatePatchBody({ dose: '' });
    expect(r).toEqual({ ok: true, value: { dose: '' } });
  });

  it('keeps supplement fields off other event types', () => {
    expect(patchMismatch('caffeine', { substance: 'melatonin' })).toMatch(/supplement/);
    expect(patchMismatch('meal', { dose: '25 mg' })).toMatch(/supplement/);
    expect(patchMismatch('nap', { note: 'x' })).toMatch(/supplement/);
    expect(patchMismatch('supplement', { substance: 'melatonin', dose: '1.9 mg' })).toBeNull();
  });

  it('keeps caffeine kind off a supplement row', () => {
    expect(patchMismatch('supplement', { kind: 'tea' })).toMatch(/caffeine/);
  });
});
