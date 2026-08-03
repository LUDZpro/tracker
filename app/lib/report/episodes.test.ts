import { describe, expect, it } from 'vitest';
import {
  buildEpisodes,
  buildNaps,
  buildRatings,
  buildTimedPoints,
  confidenceOf,
  countByDay,
  coverageBlocks,
  dayRange,
  reportDayKey,
} from './episodes';
import type { AppEvent, EventType } from '../types';

/** The store returns a `synthetic` precision that the writable `Precision`
 *  union deliberately excludes, so fixtures have to be able to say it. */
type EventOverrides = Partial<Omit<AppEvent, 'precision'>> & { precision?: string };

let seq = 0;
function ev(type: EventType, occurredAt: string, extra: EventOverrides = {}): AppEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    type,
    category:
      type === 'sleep_start' || type === 'wake_up'
        ? 'marker'
        : type === 'caffeine'
          ? 'intake'
          : type === 'mood' || type === 'energy'
            ? 'state'
            : 'action',
    occurredAt,
    precision: 'exact',
    ...extra,
  } as AppEvent;
}

const night = (startIso: string, endIso: string, extra: EventOverrides = {}) => [
  ev('sleep_start', startIso, extra),
  ev('wake_up', endIso, extra),
];

describe('reportDayKey', () => {
  it('credits an after-midnight onset to the previous day', () => {
    expect(reportDayKey('2026-07-30T02:00:00+01:00')).toBe('2026-07-29');
  });

  it('leaves an evening onset on its own day', () => {
    expect(reportDayKey('2026-07-30T23:00:00+01:00')).toBe('2026-07-30');
  });

  it('puts noon exactly on the new day', () => {
    expect(reportDayKey('2026-07-30T12:00:00+01:00')).toBe('2026-07-30');
    expect(reportDayKey('2026-07-30T11:59:00+01:00')).toBe('2026-07-29');
  });

  it('honours a custom anchor hour', () => {
    expect(reportDayKey('2026-07-30T15:00:00+01:00', 18)).toBe('2026-07-29');
  });
});

describe('confidenceOf', () => {
  it('maps the import-only synthetic value to reconstructed', () => {
    expect(confidenceOf('synthetic')).toBe('reconstructed');
  });

  it('maps coarse precisions to approximate', () => {
    expect(confidenceOf('~hour')).toBe('approximate');
    expect(confidenceOf('~part_of_day')).toBe('approximate');
  });

  it('treats exact and ~5min as logged', () => {
    expect(confidenceOf('exact')).toBe('logged');
    expect(confidenceOf('~5min')).toBe('logged');
  });

  it('defaults an absent precision to logged', () => {
    expect(confidenceOf(null)).toBe('logged');
    expect(confidenceOf(undefined)).toBe('logged');
  });
});

describe('buildEpisodes', () => {
  it('measures duration on the wall clock', () => {
    const [e] = buildEpisodes(night('2026-07-30T00:31:00+01:00', '2026-07-30T06:02:00+01:00'));
    expect(e.durationMinutes).toBe(331);
  });

  it('marks the longest span of a reporting day as main', () => {
    const events = [
      ...night('2026-07-30T00:31:00+01:00', '2026-07-30T06:02:00+01:00'), // 5h31
      ...night('2026-07-30T07:31:00+01:00', '2026-07-30T12:10:00+01:00'), // 4h39
    ];
    const episodes = buildEpisodes(events);
    // Both belong to reporting day Jul 29 (onsets before noon).
    expect(episodes.map((e) => e.dayKey)).toEqual(['2026-07-29', '2026-07-29']);
    expect(episodes.map((e) => e.kind)).toEqual(['main', 'fragment']);
  });

  it('promotes exactly one episode when two spans tie in length', () => {
    const events = [
      ...night('2026-07-30T01:00:00+01:00', '2026-07-30T03:00:00+01:00'),
      ...night('2026-07-30T04:00:00+01:00', '2026-07-30T06:00:00+01:00'),
    ];
    const kinds = buildEpisodes(events).map((e) => e.kind);
    expect(kinds.filter((k) => k === 'main')).toHaveLength(1);
    expect(kinds).toEqual(['main', 'fragment']);
  });

  it('gives each reporting day its own main sleep', () => {
    const events = [
      ...night('2026-07-28T01:18:00+01:00', '2026-07-28T10:26:00+01:00'),
      ...night('2026-07-30T00:31:00+01:00', '2026-07-30T06:02:00+01:00'),
    ];
    const episodes = buildEpisodes(events);
    expect(episodes.every((e) => e.kind === 'main')).toBe(true);
    expect(episodes.map((e) => e.dayKey)).toEqual(['2026-07-27', '2026-07-29']);
  });

  it('takes the weaker confidence of the two markers', () => {
    const events = [
      ev('sleep_start', '2026-04-14T23:30:00+00:00', { precision: 'synthetic' }),
      ev('wake_up', '2026-04-15T07:30:00+00:00', { precision: 'exact' }),
    ];
    expect(buildEpisodes(events)[0].confidence).toBe('reconstructed');
  });

  it('records onset and wake as wall minutes', () => {
    const [e] = buildEpisodes(night('2026-07-30T00:31:00+01:00', '2026-07-30T06:02:00+01:00'));
    expect(e.startMinutes).toBe(31);
    expect(e.endMinutes).toBe(6 * 60 + 2);
  });

  it('returns nothing when a sleep never closes', () => {
    expect(buildEpisodes([ev('sleep_start', '2026-07-30T01:00:00+01:00')])).toEqual([]);
  });
});

describe('buildNaps', () => {
  it('keeps a logged duration', () => {
    const naps = buildNaps([ev('nap', '2026-07-10T12:24:00+01:00', { duration: 40 })]);
    expect(naps[0].durationMinutes).toBe(40);
    expect(naps[0].startMinutes).toBe(12 * 60 + 24);
  });

  it('allows a nap with no duration', () => {
    expect(buildNaps([ev('nap', '2026-07-10T12:24:00+01:00')])[0].durationMinutes).toBeNull();
  });

  it('ignores non-nap events', () => {
    expect(buildNaps([ev('meal', '2026-07-10T12:24:00+01:00')])).toEqual([]);
  });
});

describe('buildTimedPoints / buildRatings', () => {
  it('places points on the clock with a label', () => {
    const pts = buildTimedPoints(
      [ev('caffeine', '2026-07-30T13:40:00+01:00', { kind: 'coffee' })],
      'caffeine',
      (e) => e.kind ?? 'other',
    );
    expect(pts).toEqual([
      {
        atIso: '2026-07-30T13:40:00+01:00',
        dayKey: '2026-07-30',
        minutes: 13 * 60 + 40,
        label: 'coffee',
      },
    ]);
  });

  it('keeps only ratings that carry an intensity', () => {
    const ratings = buildRatings(
      [
        ev('mood', '2026-07-30T10:00:00+01:00', { intensity: 3 }),
        ev('mood', '2026-07-30T11:00:00+01:00'),
      ],
      'mood',
    );
    expect(ratings).toHaveLength(1);
    expect(ratings[0].value).toBe(3);
  });
});

describe('dayRange', () => {
  it('is inclusive of both ends', () => {
    expect(dayRange('2026-07-28', '2026-07-31')).toEqual([
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
    ]);
  });

  it('returns a single day when both ends match', () => {
    expect(dayRange('2026-07-28', '2026-07-28')).toEqual(['2026-07-28']);
  });

  it('returns nothing for a reversed range', () => {
    expect(dayRange('2026-07-31', '2026-07-28')).toEqual([]);
  });

  it('spans a month boundary', () => {
    expect(dayRange('2026-07-30', '2026-08-02')).toHaveLength(4);
  });
});

describe('countByDay', () => {
  const keys = dayRange('2026-07-28', '2026-07-30');

  it('fills unlogged days with zero', () => {
    const counts = countByDay(
      [{ dayKey: '2026-07-28' }, { dayKey: '2026-07-28' }],
      keys,
      new Set(keys),
    );
    expect(counts.map((c) => c.count)).toEqual([2, 0, 0]);
  });

  it('separates an uncovered day from a zero day', () => {
    const counts = countByDay([], keys, new Set(['2026-07-28']));
    expect(counts.map((c) => c.covered)).toEqual([true, false, false]);
  });
});

describe('coverageBlocks', () => {
  it('joins consecutive days into one block', () => {
    expect(coverageBlocks(['2026-07-28', '2026-07-29', '2026-07-30'])).toEqual([
      { fromKey: '2026-07-28', toKey: '2026-07-30', days: 3 },
    ]);
  });

  it('splits on a gap longer than the tolerance', () => {
    const blocks = coverageBlocks(['2026-06-01', '2026-06-02', '2026-07-07', '2026-07-08']);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].toKey).toBe('2026-06-02');
    expect(blocks[1].fromKey).toBe('2026-07-07');
  });

  it('tolerates a short gap inside one block', () => {
    expect(coverageBlocks(['2026-07-01', '2026-07-03'])).toHaveLength(1);
  });

  it('deduplicates and sorts its input', () => {
    expect(coverageBlocks(['2026-07-03', '2026-07-01', '2026-07-03'])).toEqual([
      { fromKey: '2026-07-01', toKey: '2026-07-03', days: 3 },
    ]);
  });

  it('returns nothing for no days', () => {
    expect(coverageBlocks([])).toEqual([]);
  });
});
