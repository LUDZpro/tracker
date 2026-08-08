import { describe, expect, it } from 'vitest';
import { defaultDoseOf, formatDose, intakeLabel, labelForEvent, parseDose } from './format';
import { parseRegistry, parseSubstance, isSubstanceId } from './types';
import type { Substance } from './types';

const MELATONIN: Substance = {
  id: 'melatonin',
  name: 'Melatonin',
  type: 'melatonin',
  defaultDose: 1.9,
  unit: 'mg',
};

describe('formatDose', () => {
  it('keeps integers clean', () => {
    expect(formatDose({ amount: 25, unit: 'mg' })).toBe('25 mg');
  });

  it('keeps a real fraction', () => {
    expect(formatDose({ amount: 1.9, unit: 'mg' })).toBe('1.9 mg');
  });

  it('drops trailing zeros rather than printing 1.90', () => {
    expect(formatDose({ amount: 1.9000000001, unit: 'mg' })).toBe('1.9 mg');
    expect(formatDose({ amount: 200.0, unit: 'mg' })).toBe('200 mg');
  });

  it('handles a unit with no space needed', () => {
    expect(formatDose({ amount: 2000, unit: 'IU' })).toBe('2000 IU');
  });
});

describe('parseDose', () => {
  it('round-trips what formatDose writes', () => {
    for (const dose of [
      { amount: 25, unit: 'mg' },
      { amount: 1.9, unit: 'mg' },
      { amount: 2000, unit: 'IU' },
    ]) {
      expect(parseDose(formatDose(dose))).toEqual(dose);
    }
  });

  it('tolerates a missing space', () => {
    expect(parseDose('25mg')).toEqual({ amount: 25, unit: 'mg' });
  });

  it('tolerates extra whitespace', () => {
    expect(parseDose('  1.9   mg  ')).toEqual({ amount: 1.9, unit: 'mg' });
  });

  it('returns null for junk rather than NaN', () => {
    expect(parseDose('one pill')).toBeNull();
    expect(parseDose('')).toBeNull();
    expect(parseDose(undefined)).toBeNull();
    expect(parseDose('-5 mg')).toBeNull();
    expect(parseDose('0 mg')).toBeNull();
  });

  it('accepts a bare number with no unit', () => {
    expect(parseDose('25')).toEqual({ amount: 25, unit: '' });
  });
});

describe('intakeLabel', () => {
  it('follows the category:type — description convention', () => {
    expect(intakeLabel('melatonin', '1.9 mg')).toBe('intake:melatonin — 1.9 mg');
  });

  it('omits the dash when there is no dose', () => {
    expect(intakeLabel('d3')).toBe('intake:d3');
  });
});

describe('labelForEvent', () => {
  const registry = [MELATONIN];

  it('uses the registry type, not the id', () => {
    expect(labelForEvent('melatonin', '1.9 mg', registry)).toBe('intake:melatonin — 1.9 mg');
  });

  it('falls back to the raw substance when the registry has dropped it', () => {
    expect(labelForEvent('kratom', '2 g', registry)).toBe('intake:kratom — 2 g');
  });

  it('survives an event with no substance at all', () => {
    expect(labelForEvent(undefined, undefined, registry)).toBe('intake:supplement');
  });
});

describe('defaultDoseOf', () => {
  it('returns the registry default', () => {
    expect(defaultDoseOf(MELATONIN)).toEqual({ amount: 1.9, unit: 'mg' });
  });

  it('returns null when the dose is still TBD', () => {
    expect(defaultDoseOf({ id: 'vitamin_d3', name: 'D3', type: 'd3', unit: 'IU' })).toBeNull();
  });
});

describe('isSubstanceId', () => {
  it('accepts slugs', () => {
    expect(isSubstanceId('melatonin')).toBe(true);
    expect(isSubstanceId('vitamin_d3')).toBe(true);
    expect(isSubstanceId('omega-3')).toBe(true);
  });

  it('rejects anything that could smuggle punctuation into a label', () => {
    expect(isSubstanceId('Melatonin')).toBe(false);
    expect(isSubstanceId('_leading')).toBe(false);
    expect(isSubstanceId('with space')).toBe(false);
    expect(isSubstanceId('')).toBe(false);
    expect(isSubstanceId('a'.repeat(41))).toBe(false);
    expect(isSubstanceId(42)).toBe(false);
  });
});

describe('parseSubstance', () => {
  it('accepts a full entry', () => {
    expect(parseSubstance({ ...MELATONIN, timeHint: 'evening' })).toEqual({
      ...MELATONIN,
      timeHint: 'evening',
    });
  });

  it('accepts an entry with no dose yet', () => {
    expect(parseSubstance({ id: 'vitamin_d3', name: 'D3', type: 'd3', unit: 'IU' })).toEqual({
      id: 'vitamin_d3',
      name: 'D3',
      type: 'd3',
      unit: 'IU',
    });
  });

  it('rejects a bad dose instead of writing NaN to the log', () => {
    expect(parseSubstance({ ...MELATONIN, defaultDose: 'lots' })).toBeNull();
    expect(parseSubstance({ ...MELATONIN, defaultDose: 0 })).toBeNull();
    expect(parseSubstance({ ...MELATONIN, defaultDose: -1 })).toBeNull();
  });

  it('rejects an unknown time hint', () => {
    expect(parseSubstance({ ...MELATONIN, timeHint: 'brunch' })).toBeNull();
  });

  it('rejects missing required fields', () => {
    expect(parseSubstance({ id: 'x', name: 'X', type: 'x' })).toBeNull();
    expect(parseSubstance(null)).toBeNull();
  });
});

describe('parseRegistry', () => {
  it('drops malformed entries but keeps the good ones', () => {
    const out = parseRegistry({
      substances: [MELATONIN, { id: 'broken' }, { ...MELATONIN, id: 'magnesium' }],
    });
    expect(out.map((s) => s.id)).toEqual(['melatonin', 'magnesium']);
  });

  it('drops duplicate ids, first one wins', () => {
    const out = parseRegistry({
      substances: [MELATONIN, { ...MELATONIN, name: 'Impostor' }],
    });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Melatonin');
  });

  it('returns empty for a shapeless file rather than throwing', () => {
    expect(parseRegistry({})).toEqual([]);
    expect(parseRegistry(null)).toEqual([]);
    expect(parseRegistry({ substances: 'nope' })).toEqual([]);
  });
});
