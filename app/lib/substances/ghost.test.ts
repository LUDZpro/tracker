import { describe, expect, it } from 'vitest';
import { clearLandedGhosts } from '@/components/meds/ghost';
import type { AppEvent } from '@/lib/types';

const ghost = (substance: string, occurredAt: string): AppEvent => ({
  id: `ghost-${substance}`,
  type: 'supplement',
  category: 'intake',
  occurredAt,
  precision: 'exact',
  substance,
  editable: false,
});

const real = (substance: string, occurredAt: string): AppEvent => ({
  ...ghost(substance, occurredAt),
  id: `real-${substance}`,
  editable: true,
});

const AT = '2026-08-08T08:15:00+01:00';

describe('clearLandedGhosts', () => {
  it('drops a ghost once its real row lands', () => {
    expect(clearLandedGhosts([ghost('melatonin', AT)], [real('melatonin', AT)])).toEqual([]);
  });

  it('keeps a dose that is still queued offline', () => {
    // The whole point: an offline dose has no server row, and dropping it
    // would hide it from the list that prevents double-dosing.
    const g = [ghost('melatonin', AT)];
    expect(clearLandedGhosts(g, [])).toBe(g);
  });

  it('keeps a ghost when a different substance lands', () => {
    const g = [ghost('melatonin', AT)];
    expect(clearLandedGhosts(g, [real('magnesium', AT)])).toBe(g);
  });

  it('keeps a second dose of the same substance at a different minute', () => {
    const later = '2026-08-08T22:40:00+01:00';
    const out = clearLandedGhosts(
      [ghost('melatonin', AT), ghost('melatonin', later)],
      [real('melatonin', AT)],
    );
    expect(out).toHaveLength(1);
    expect(out[0].occurredAt).toBe(later);
  });

  it('ignores seconds when matching', () => {
    const withSeconds = '2026-08-08T08:15:42+01:00';
    expect(clearLandedGhosts([ghost('melatonin', AT)], [real('melatonin', withSeconds)])).toEqual([]);
  });

  it('does not match a non-supplement row that happens to align', () => {
    const caffeine: AppEvent = {
      id: 'c1',
      type: 'caffeine',
      category: 'intake',
      occurredAt: AT,
      precision: 'exact',
    };
    const g = [ghost('melatonin', AT)];
    expect(clearLandedGhosts(g, [caffeine])).toBe(g);
  });

  it('returns the same array reference when nothing changed, so the effect cannot loop', () => {
    const g = [ghost('melatonin', AT)];
    expect(clearLandedGhosts(g, [])).toBe(g);
  });
});
