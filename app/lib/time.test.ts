import { describe, expect, it } from 'vitest';
import {
  addMinutes,
  minutesBetween,
  shiftDateKey,
  wallHHMM,
  wallMinutes,
  wallMinutesBetween,
  wallParts,
  withWallDate,
  withWallTime,
} from './time';

describe('wallMinutesBetween', () => {
  it('measures a plain overnight span', () => {
    expect(
      wallMinutesBetween('2026-07-30T00:31:00+01:00', '2026-07-30T06:02:00+01:00'),
    ).toBe(331);
  });

  it('crosses midnight', () => {
    expect(
      wallMinutesBetween('2026-07-28T23:30:00+01:00', '2026-07-29T07:30:00+01:00'),
    ).toBe(480);
  });

  it('ignores a mislabelled offset seam that minutesBetween trips over', () => {
    // Imported rows are stamped +00:00, later rows +01:00, for the same
    // real-world offset. The wall reading is the trustworthy one.
    const from = '2026-06-02T23:00:00+00:00';
    const to = '2026-06-03T07:00:00+01:00';
    expect(minutesBetween(from, to)).toBe(420);
    expect(wallMinutesBetween(from, to)).toBe(480);
  });

  it('returns a negative span when the arguments are reversed', () => {
    expect(
      wallMinutesBetween('2026-07-30T06:00:00+01:00', '2026-07-30T05:00:00+01:00'),
    ).toBe(-60);
  });

  it('returns 0 for an unparseable timestamp', () => {
    expect(wallMinutesBetween('nonsense', '2026-07-30T06:00:00+01:00')).toBe(0);
  });
});

describe('wall-clock helpers', () => {
  it('parses the wall part regardless of offset', () => {
    expect(wallParts('2026-07-06T07:12:00+01:00')).toEqual({
      year: 2026, month: 7, day: 6, hour: 7, minute: 12,
    });
    expect(wallMinutes('2026-07-06T07:12:00-05:00')).toBe(7 * 60 + 12);
    expect(wallHHMM('2026-07-06T07:12:00+01:00')).toBe('07:12');
  });

  it('computes chronological distance with offsets respected', () => {
    expect(minutesBetween('2026-07-05T23:30:00+01:00', '2026-07-06T07:00:00+01:00')).toBe(450);
  });

  it('adds minutes while preserving the explicit offset', () => {
    expect(addMinutes('2026-07-06T00:15:00+01:00', -30)).toBe('2026-07-05T23:45:00+01:00');
    expect(addMinutes('2026-07-06T23:45:00-05:00', 30)).toBe('2026-07-07T00:15:00-05:00');
    expect(addMinutes('2026-07-06T23:45:00Z', 30)).toBe('2026-07-07T00:15:00Z');
  });

  it('shifts date keys across month boundaries', () => {
    expect(shiftDateKey('2026-07-01', -1)).toBe('2026-06-30');
    expect(shiftDateKey('2026-07-06', -3)).toBe('2026-07-03');
  });

  it('replaces the wall time, preserving date and offset', () => {
    expect(withWallTime('2026-07-06T07:12:00+01:00', 8, 35)).toBe('2026-07-06T08:35:00+01:00');
    expect(withWallTime('2026-07-06T07:12:00-05:00', 0, 0)).toBe('2026-07-06T00:00:00-05:00');
    expect(withWallTime('2026-07-06T07:12:00+01:00', 9, 5)).toBe('2026-07-06T09:05:00+01:00');
  });

  it('clamps out-of-range wall time components', () => {
    expect(withWallTime('2026-07-06T07:12:00+01:00', 25, 75)).toBe('2026-07-06T23:59:00+01:00');
    expect(withWallTime('2026-07-06T07:12:00+01:00', -1, -1)).toBe('2026-07-06T00:00:00+01:00');
  });

  it('replaces the wall date, preserving time and offset', () => {
    expect(withWallDate('2026-07-06T07:12:00+01:00', '2026-07-05')).toBe(
      '2026-07-05T07:12:00+01:00',
    );
    expect(withWallDate('2026-07-06T07:12:00+01:00', 'garbage')).toBe(
      '2026-07-06T07:12:00+01:00',
    );
  });
});
