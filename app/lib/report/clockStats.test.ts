import { describe, expect, it } from 'vitest';
import {
  circularClockStat,
  formatClock,
  formatHours,
  formatSpan,
  mean,
  median,
  nightAxisMinutes,
  stdDev,
} from './clockStats';

const at = (h: number, m = 0) => h * 60 + m;

describe('circularClockStat', () => {
  it('returns null for an empty sample', () => {
    expect(circularClockStat([])).toBeNull();
  });

  it('averages times either side of midnight to midnight, not to noon', () => {
    const stat = circularClockStat([at(23, 40), at(0, 20)]);
    expect(stat).not.toBeNull();
    // A linear mean would give 12:00 here — the bug this module exists for.
    expect(formatClock((stat as NonNullable<typeof stat>).meanMinutes)).toBe('00:00');
  });

  it('matches the plain mean when no value crosses midnight', () => {
    const stat = circularClockStat([at(8), at(10)]);
    expect(formatClock((stat as NonNullable<typeof stat>).meanMinutes)).toBe('09:00');
  });

  it('reports full concentration when every time is identical', () => {
    const stat = circularClockStat([at(2), at(2), at(2)]);
    expect((stat as NonNullable<typeof stat>).concentration).toBeCloseTo(1, 10);
    expect((stat as NonNullable<typeof stat>).sdMinutes).toBeCloseTo(0, 6);
  });

  it('grows the SD as onsets spread out', () => {
    const tight = circularClockStat([at(1), at(1, 30), at(2)]);
    const loose = circularClockStat([at(20), at(2), at(8)]);
    expect((loose as NonNullable<typeof loose>).sdMinutes).toBeGreaterThan(
      (tight as NonNullable<typeof tight>).sdMinutes,
    );
  });

  it('clamps SD at half a day for antipodal times with no centre', () => {
    const stat = circularClockStat([at(0), at(12)]);
    expect((stat as NonNullable<typeof stat>).concentration).toBeCloseTo(0, 10);
    expect((stat as NonNullable<typeof stat>).sdMinutes).toBe(720);
  });

  it('counts the sample', () => {
    expect((circularClockStat([at(1), at(2), at(3)]) as { n: number }).n).toBe(3);
  });
});

describe('mean / stdDev / median', () => {
  it('returns null on empty input', () => {
    expect(mean([])).toBeNull();
    expect(median([])).toBeNull();
    expect(stdDev([])).toBeNull();
  });

  it('needs two values for a sample SD', () => {
    expect(stdDev([5])).toBeNull();
  });

  it('computes the sample SD with n-1', () => {
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9]) as number).toBeCloseTo(2.138, 3);
  });

  it('averages an even-length median across the middle pair', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('does not mutate the caller array', () => {
    const input = [3, 1, 2];
    median(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe('nightAxisMinutes', () => {
  it('pushes early-morning times past the end of the day', () => {
    expect(nightAxisMinutes(at(2))).toBe(at(26));
  });

  it('leaves evening times alone', () => {
    expect(nightAxisMinutes(at(22))).toBe(at(22));
  });

  it('honours a custom cut hour', () => {
    expect(nightAxisMinutes(at(14), 18)).toBe(at(38));
  });
});

describe('formatting', () => {
  it('pads clock times', () => {
    expect(formatClock(at(2, 6))).toBe('02:06');
    expect(formatClock(at(0, 0))).toBe('00:00');
  });

  it('wraps clock values beyond one day', () => {
    expect(formatClock(at(26))).toBe('02:00');
    expect(formatClock(-60)).toBe('23:00');
  });

  it('drops the hour part below an hour', () => {
    expect(formatSpan(48)).toBe('48m');
  });

  it('drops the minute part on a whole hour', () => {
    expect(formatSpan(120)).toBe('2h');
  });

  it('renders hours and minutes together', () => {
    expect(formatSpan(432)).toBe('7h 12m');
  });

  it('renders decimal hours for the summary table', () => {
    expect(formatHours(432)).toBe('7.2 h');
  });
});
