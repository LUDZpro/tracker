import { describe, expect, it } from 'vitest';
import {
  CAFFEINE_COUNT_GOAL,
  CAFFEINE_TIME_GOAL,
  GYM_GOAL,
  PROTEIN_GOAL,
  SLEEP_GOAL,
  coverage,
  evaluate,
  heightPct,
  hitCount,
  isBreach,
  paceAt,
  rulePct,
  scaleFor,
} from './goals';

describe('evaluate', () => {
  it('never scores an unlogged day', () => {
    expect(evaluate(SLEEP_GOAL, null)).toBe('none');
    expect(evaluate(PROTEIN_GOAL, null)).toBe('none');
    expect(evaluate(GYM_GOAL, null)).toBe('none');
  });

  it('separates a zero from an unlogged day', () => {
    // The defect this module exists to prevent: 0 is a real, bad value;
    // null is the absence of a value.
    expect(evaluate(PROTEIN_GOAL, 0)).toBe('bad');
    expect(evaluate(PROTEIN_GOAL, null)).toBe('none');
  });

  describe('band (sleep)', () => {
    it('treats both directions as a miss', () => {
      expect(evaluate(SLEEP_GOAL, 8 * 60)).toBe('goal');
      expect(evaluate(SLEEP_GOAL, 6 * 60 + 30)).toBe('under');
      expect(evaluate(SLEEP_GOAL, 9 * 60 + 30)).toBe('over');
    });

    it('is inclusive at both bounds', () => {
      expect(evaluate(SLEEP_GOAL, 7 * 60)).toBe('goal');
      expect(evaluate(SLEEP_GOAL, 9 * 60)).toBe('goal');
    });

    it('escalates a material miss', () => {
      expect(evaluate(SLEEP_GOAL, 5 * 60 + 35)).toBe('bad');
      expect(evaluate(SLEEP_GOAL, 11 * 60)).toBe('bad');
    });

    it('does not reward a long night as a taller win', () => {
      // The old sparkline drew 10h as the best night of the week.
      expect(evaluate(SLEEP_GOAL, 10 * 60 + 30)).toBe('bad');
      expect(isBreach(evaluate(SLEEP_GOAL, 10 * 60 + 30))).toBe(true);
    });
  });

  describe('floor (protein)', () => {
    it('meets at the bound and above', () => {
      expect(evaluate(PROTEIN_GOAL, 160)).toBe('goal');
      expect(evaluate(PROTEIN_GOAL, 232)).toBe('goal');
    });

    it('grades the shortfall', () => {
      expect(evaluate(PROTEIN_GOAL, 148)).toBe('under');
      expect(evaluate(PROTEIN_GOAL, 60)).toBe('bad');
    });
  });

  describe('ceiling (caffeine count)', () => {
    it('meets at or under the max', () => {
      expect(evaluate(CAFFEINE_COUNT_GOAL, 3)).toBe('goal');
      expect(evaluate(CAFFEINE_COUNT_GOAL, 1)).toBe('goal');
    });

    it('flags going over', () => {
      expect(evaluate(CAFFEINE_COUNT_GOAL, 4)).toBe('over');
      expect(evaluate(CAFFEINE_COUNT_GOAL, 6)).toBe('bad');
    });
  });

  describe('cutoff (caffeine time)', () => {
    it('meets up to and including the cutoff', () => {
      expect(evaluate(CAFFEINE_TIME_GOAL, 10 * 60 + 45)).toBe('goal');
      expect(evaluate(CAFFEINE_TIME_GOAL, 16 * 60)).toBe('goal');
    });

    it('grades how late', () => {
      expect(evaluate(CAFFEINE_TIME_GOAL, 17 * 60 + 40)).toBe('over');
      expect(evaluate(CAFFEINE_TIME_GOAL, 19 * 60 + 5)).toBe('bad');
    });
  });

  describe('presence (gym)', () => {
    it('is met by any session and absent otherwise', () => {
      expect(evaluate(GYM_GOAL, 1)).toBe('goal');
      expect(evaluate(GYM_GOAL, 0)).toBe('none');
    });
  });
});

describe('scaleFor', () => {
  it('uses the declared ceiling for an ordinary week', () => {
    expect(scaleFor(PROTEIN_GOAL, [148, 172, 96, null, 178])).toBe(200);
  });

  it('raises the ceiling rather than clipping an outlier', () => {
    // WeekStats used to clamp to 100%, making 172g, 178g and 232g identical.
    expect(scaleFor(PROTEIN_GOAL, [148, 232, null])).toBe(232);
  });

  it('ignores unlogged days when finding the observed max', () => {
    expect(scaleFor(SLEEP_GOAL, [null, null])).toBe(SLEEP_GOAL.scaleMax);
  });
});

describe('heightPct', () => {
  it('scales proportionally', () => {
    expect(heightPct(100, 200)).toBe(50);
  });

  it('keeps a tiny value visible', () => {
    expect(heightPct(1, 1000)).toBe(3);
  });

  it('never overflows its track', () => {
    expect(heightPct(300, 200)).toBe(100);
  });

  it('is safe on a zero scale', () => {
    expect(heightPct(5, 0)).toBe(0);
  });
});

describe('rulePct', () => {
  it('places the goal line', () => {
    expect(rulePct(PROTEIN_GOAL.min, 200)).toBe(80);
    expect(rulePct(SLEEP_GOAL.min, SLEEP_GOAL.scaleMax)).toBe(70);
  });

  it('clamps out-of-range bounds', () => {
    expect(rulePct(500, 200)).toBe(100);
    expect(rulePct(-10, 200)).toBe(0);
  });
});

describe('coverage', () => {
  it('counts logged days, not calendar days', () => {
    const c = coverage([1, 2, null, 4, 5, 6, null]);
    expect(c.logged).toBe(5);
    expect(c.total).toBe(7);
    expect(c.thin).toBe(false);
  });

  it('flags a thin week', () => {
    expect(coverage([1, 2, 3, null, null, null, null]).thin).toBe(true);
  });

  it('suppresses a summary built on almost nothing', () => {
    expect(coverage([1, null, null, null, null, null, null]).insufficient).toBe(true);
    expect(coverage([1, 2, null, null, null, null, null]).insufficient).toBe(false);
  });
});

describe('hitCount', () => {
  it('reports hits over logged days, never over calendar days', () => {
    const week = [7 * 60 + 45, 6 * 60 + 10, null, 8 * 60 + 20, 5 * 60 + 35, 9 * 60 + 30, 7 * 60 + 20];
    expect(hitCount(SLEEP_GOAL, week)).toEqual({ hits: 3, logged: 6 });
  });

  it('is empty for a week with nothing in it', () => {
    expect(hitCount(SLEEP_GOAL, [null, null])).toEqual({ hits: 0, logged: 0 });
  });
});

describe('paceAt', () => {
  it('expects little in the morning and everything by night', () => {
    expect(paceAt(8, 160)).toBe(20);
    expect(paceAt(22, 160)).toBe(160);
  });

  it('makes the same value ahead at noon and behind at night', () => {
    const value = 112;
    expect(value).toBeGreaterThan(paceAt(14.5, 160));
    expect(value).toBeLessThan(paceAt(20, 160));
  });

  it('clamps outside the window', () => {
    expect(paceAt(3, 160)).toBe(8);
    expect(paceAt(26, 160)).toBe(160);
  });
});
