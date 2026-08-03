import { describe, expect, it } from 'vitest';
import { buildReport, emptyReport } from './build';
import type { AppEvent, EventType } from '../types';

/** The store returns a `synthetic` precision that the writable `Precision`
 *  union deliberately excludes, so fixtures have to be able to say it. */
type EventOverrides = Partial<Omit<AppEvent, 'precision'>> & { precision?: string };

let seq = 0;
function ev(type: EventType, occurredAt: string, extra: EventOverrides = {}): AppEvent {
  seq += 1;
  return {
    id: `b${seq}`,
    type,
    category:
      type === 'sleep_start' || type === 'wake_up'
        ? 'marker'
        : type === 'caffeine'
          ? 'intake'
          : 'action',
    occurredAt,
    precision: 'exact',
    ...extra,
  } as AppEvent;
}
const night = (s: string, e: string, extra: EventOverrides = {}) => [
  ev('sleep_start', s, extra),
  ev('wake_up', e, extra),
];

const NOW = '2026-08-03T12:00:00+01:00';

describe('buildReport', () => {
  it('returns an empty document for no events', () => {
    const r = buildReport([], NOW);
    expect(r.meta.generatedIso).toBe(NOW);
    expect(r.days).toEqual([]);
    expect(r.sleep.days).toBe(0);
  });

  it('spans first to last calendar day including untracked gaps', () => {
    const r = buildReport(
      [
        ...night('2026-07-01T23:00:00+01:00', '2026-07-02T07:00:00+01:00'),
        ...night('2026-07-20T23:00:00+01:00', '2026-07-21T07:00:00+01:00'),
      ],
      NOW,
    );
    expect(r.meta.fromKey).toBe('2026-07-01');
    expect(r.meta.toKey).toBe('2026-07-21');
    expect(r.meta.spanDays).toBe(21);
    expect(r.meta.trackedDays).toBe(4);
  });

  it('splits the record into coverage blocks around a long gap', () => {
    const r = buildReport(
      [
        ...night('2026-06-01T23:00:00+01:00', '2026-06-02T07:00:00+01:00'),
        ...night('2026-07-07T23:00:00+01:00', '2026-07-08T07:00:00+01:00'),
      ],
      NOW,
    );
    expect(r.meta.blocks).toHaveLength(2);
  });

  it('surfaces more than one offset as an import seam', () => {
    const r = buildReport(
      [
        ...night('2026-05-01T23:00:00+00:00', '2026-05-02T07:00:00+00:00'),
        ...night('2026-07-07T23:00:00+01:00', '2026-07-08T07:00:00+01:00'),
      ],
      NOW,
    );
    expect(r.meta.offsets).toEqual(['+00:00', '+01:00']);
  });

  it('builds one night row per main sleep with its fragment count', () => {
    const r = buildReport(
      [
        ...night('2026-07-29T00:31:00+01:00', '2026-07-29T06:02:00+01:00'),
        ...night('2026-07-29T07:31:00+01:00', '2026-07-29T10:10:00+01:00'),
      ],
      NOW,
    );
    expect(r.days).toHaveLength(1);
    expect(r.days[0].main.minutes).toBe(331);
    expect(r.days[0].extras).toHaveLength(1);
    expect(r.days[0].totalMinutes).toBe(331 + 159);
  });

  it('averages meals only over days after meal tracking began', () => {
    const events = [
      // Sleep-only stretch in May — no meals logged yet.
      ...night('2026-05-01T23:00:00+00:00', '2026-05-02T07:00:00+00:00'),
      ...night('2026-05-02T23:00:00+00:00', '2026-05-03T07:00:00+00:00'),
      // Meal tracking starts in July.
      ev('meal', '2026-07-10T13:00:00+01:00'),
      ev('meal', '2026-07-10T19:00:00+01:00'),
      ev('meal', '2026-07-11T13:00:00+01:00'),
    ];
    const r = buildReport(events, NOW);
    expect(r.mealTrackingFromKey).toBe('2026-07-10');
    // Two covered days in the meal window, three meals.
    expect(r.intake.mealDaysCovered).toBe(2);
    expect(r.intake.meanMealsPerDay).toBe(1.5);
  });

  it('does not let the pre-meal months drag the daily average to zero', () => {
    const r = buildReport(
      [
        ...night('2026-04-01T23:00:00+00:00', '2026-04-02T07:00:00+00:00'),
        ev('meal', '2026-07-10T13:00:00+01:00'),
      ],
      NOW,
    );
    expect(r.intake.meanMealsPerDay).toBe(1);
    expect(r.mealsPerDay.every((d) => d.dayKey >= '2026-07-10')).toBe(true);
  });

  it('counts overnight meals', () => {
    const r = buildReport(
      [ev('meal', '2026-07-29T03:48:00+01:00'), ev('meal', '2026-07-29T13:24:00+01:00')],
      NOW,
    );
    expect(r.intake.meals).toBe(2);
    expect(r.intake.nightMeals).toBe(1);
  });

  it('gives the actogram a row for every calendar day in range', () => {
    const r = buildReport(
      [
        ...night('2026-07-01T23:00:00+01:00', '2026-07-02T07:00:00+01:00'),
        ...night('2026-07-05T23:00:00+01:00', '2026-07-06T07:00:00+01:00'),
      ],
      NOW,
    );
    expect(r.actogram).toHaveLength(r.meta.spanDays);
    expect(r.actogram.filter((row) => row.spans.length > 0)).toHaveLength(2);
  });

  it('separates reconstructed nights from logged ones', () => {
    const r = buildReport(
      [
        ...night('2026-04-14T23:30:00+00:00', '2026-04-15T07:30:00+00:00', {
          precision: 'synthetic',
        }),
        ...night('2026-07-30T00:31:00+01:00', '2026-07-30T06:02:00+01:00'),
      ],
      NOW,
    );
    expect(r.confidence).toEqual({ logged: 1, approximate: 0, reconstructed: 1 });
  });

  it('collects mood and energy ratings separately', () => {
    const r = buildReport(
      [
        ev('mood', '2026-07-30T10:00:00+01:00', { intensity: 3 }),
        ev('energy', '2026-07-30T10:00:00+01:00', { intensity: 1 }),
      ],
      NOW,
    );
    expect(r.mood).toHaveLength(1);
    expect(r.energy).toHaveLength(1);
    expect(r.energy[0].value).toBe(1);
  });
});

describe('emptyReport', () => {
  it('is safe to render before data arrives', () => {
    const r = emptyReport();
    expect(r.rangeKeys).toEqual([]);
    expect(r.regularity.sri).toBeNull();
    expect(r.intake.meanMealsPerDay).toBeNull();
  });
});
