import { describe, expect, it } from 'vitest';
import { buildDayRows, dayRowEndKey } from './days';
import { buildEpisodes } from './episodes';
import type { AppEvent, EventType } from '../types';

let seq = 0;
function ev(type: EventType, occurredAt: string): AppEvent {
  seq += 1;
  return {
    id: `d${seq}`,
    type,
    category: 'marker',
    occurredAt,
    precision: 'exact',
  } as AppEvent;
}

const night = (s: string, e: string) => [ev('sleep_start', s), ev('wake_up', e)];

/**
 * The night of 1–2 August 2026 as it was actually logged: three sleeps, all
 * of them stamped 2 August, totalling 16 h 27. The report used to render this
 * as "1 Aug — 6 h 37", which is the bug this module exists to fix.
 */
const AUG_2 = [
  ...night('2026-08-02T00:07:00+01:00', '2026-08-02T05:01:00+01:00'), // 4h54 = 294
  ...night('2026-08-02T05:34:00+01:00', '2026-08-02T12:11:00+01:00'), // 6h37 = 397
  ...night('2026-08-02T14:40:00+01:00', '2026-08-02T19:36:00+01:00'), // 4h56 = 296
];

describe('buildDayRows — night mode', () => {
  const rows = buildDayRows(buildEpisodes(AUG_2, 12), 'night');

  it('files the small-hours sleeps under the night they began', () => {
    expect(rows.map((r) => r.dayKey)).toEqual(['2026-08-01', '2026-08-02']);
  });

  it('totals every episode of a night, not just the longest', () => {
    expect(rows[0].totalMinutes).toBe(294 + 397);
    expect(rows[0].main.minutes).toBe(397);
    expect(rows[0].extras).toHaveLength(1);
    expect(rows[0].extras[0].minutes).toBe(294);
  });

  it('never splits an episode, so no edge is a cut', () => {
    for (const r of rows) {
      for (const s of r.segments) {
        expect(s.clippedStart).toBe(false);
        expect(s.clippedEnd).toBe(false);
      }
    }
  });

  it('orders a night chronologically across midnight', () => {
    const crossing = buildDayRows(
      buildEpisodes(
        [
          ...night('2026-07-27T14:09:00+01:00', '2026-07-27T16:19:00+01:00'), // afternoon
          ...night('2026-07-28T01:18:00+01:00', '2026-07-28T10:26:00+01:00'), // small hours
        ],
        12,
      ),
      'night',
    );
    expect(crossing[0].dayKey).toBe('2026-07-27');
    expect(crossing[0].segments.map((s) => s.startMinutes)).toEqual([14 * 60 + 9, 78]);
  });
});

describe('buildDayRows — calendar mode', () => {
  const rows = buildDayRows(buildEpisodes(AUG_2, 0), 'calendar');

  it('puts every sleep on the date it happened', () => {
    expect(rows.map((r) => r.dayKey)).toEqual(['2026-08-02']);
  });

  it('reports the whole 16 h 27 the day actually held', () => {
    expect(rows[0].totalMinutes).toBe(294 + 397 + 296);
    expect(rows[0].segments).toHaveLength(3);
  });

  it('still names the longest episode as main', () => {
    expect(rows[0].main.minutes).toBe(397);
  });
});

describe('buildDayRows — splitting at midnight', () => {
  const rows = buildDayRows(
    buildEpisodes(night('2026-07-30T22:00:00+01:00', '2026-07-31T06:00:00+01:00'), 0),
    'calendar',
  );

  it('gives each date its own share of a sleep that crosses midnight', () => {
    expect(rows.map((r) => r.dayKey)).toEqual(['2026-07-30', '2026-07-31']);
    expect(rows[0].totalMinutes).toBe(120);
    expect(rows[1].totalMinutes).toBe(360);
  });

  it('marks the cut edges so they are not read as an onset or a wake', () => {
    expect(rows[0].segments[0].clippedStart).toBe(false);
    expect(rows[0].segments[0].clippedEnd).toBe(true);
    expect(rows[1].segments[0].clippedStart).toBe(true);
    expect(rows[1].segments[0].clippedEnd).toBe(false);
  });

  it('keeps the true onset and wake on both halves', () => {
    for (const r of rows) {
      expect(r.segments[0].startIso).toBe('2026-07-30T22:00:00+01:00');
      expect(r.segments[0].endIso).toBe('2026-07-31T06:00:00+01:00');
    }
  });

  it('loses no minutes to the split', () => {
    const total = rows.reduce((sum, r) => sum + r.totalMinutes, 0);
    expect(total).toBe(480);
  });

  it('does not split the same sleep in night mode', () => {
    const whole = buildDayRows(
      buildEpisodes(night('2026-07-30T22:00:00+01:00', '2026-07-31T06:00:00+01:00'), 12),
      'night',
    );
    expect(whole).toHaveLength(1);
    expect(whole[0].totalMinutes).toBe(480);
  });
});

describe('buildDayRows — edges', () => {
  it('returns nothing for an empty record', () => {
    expect(buildDayRows([], 'night')).toEqual([]);
    expect(buildDayRows([], 'calendar')).toEqual([]);
  });

  it('resolves a duration tie to the earlier episode', () => {
    const rows = buildDayRows(
      buildEpisodes(
        [
          ...night('2026-07-30T13:00:00+01:00', '2026-07-30T15:00:00+01:00'),
          ...night('2026-07-30T18:00:00+01:00', '2026-07-30T20:00:00+01:00'),
        ],
        12,
      ),
      'night',
    );
    expect(rows[0].main.startMinutes).toBe(13 * 60);
  });
});

describe('dayRowEndKey', () => {
  it('reaches into the next date for a night row', () => {
    expect(dayRowEndKey('2026-08-01', 'night')).toBe('2026-08-02');
  });

  it('stays put for a calendar row', () => {
    expect(dayRowEndKey('2026-08-01', 'calendar')).toBe('2026-08-01');
  });

  it('crosses a month boundary', () => {
    expect(dayRowEndKey('2026-07-31', 'night')).toBe('2026-08-01');
  });
});
