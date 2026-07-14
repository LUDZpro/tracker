import { describe, expect, it } from 'vitest';
import {
  buildSleepPairs,
  daySleepSpans,
  checkSleepSpan,
  currentState,
  lastSleep,
  looksLikeNap,
  missingNights,
  overlapsPairs,
  wakeWindowAt,
  wakeWindowEvents,
} from './sleep';
import type { AppEvent } from './types';

let n = 0;
function ev(type: AppEvent['type'], occurredAt: string): AppEvent {
  const category =
    type === 'wake_up' || type === 'sleep_start'
      ? 'marker'
      : type === 'nap'
        ? 'action'
        : type === 'caffeine'
          ? 'intake'
          : 'state';
  return { id: `e${++n}`, type, category, occurredAt, precision: 'exact' };
}

const NOW = '2026-07-06T12:00:00+01:00';

describe('buildSleepPairs / currentState', () => {
  it('pairs sleep_start with the following wake_up', () => {
    const events = [
      ev('sleep_start', '2026-07-05T23:30:00+01:00'),
      ev('wake_up', '2026-07-06T07:15:00+01:00'),
    ];
    const pairs = buildSleepPairs(events);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].start.type).toBe('sleep_start');
    expect(currentState(events)).toBe('awake');
  });

  it('reports asleep after an unclosed sleep_start', () => {
    const events = [ev('sleep_start', '2026-07-06T00:10:00+01:00')];
    expect(currentState(events)).toBe('asleep');
    expect(buildSleepPairs(events)).toHaveLength(0);
    expect(lastSleep(events).end).toBeNull();
  });

  it('lets a later sleep_start supersede an unclosed one', () => {
    const pairs = buildSleepPairs([
      ev('sleep_start', '2026-07-05T22:00:00+01:00'),
      ev('sleep_start', '2026-07-05T23:30:00+01:00'),
      ev('wake_up', '2026-07-06T07:00:00+01:00'),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].start.occurredAt).toBe('2026-07-05T23:30:00+01:00');
  });
});

describe('wakeWindowEvents', () => {
  it('returns events since the last wake_up only', () => {
    const events = [
      ev('caffeine', '2026-07-05T15:00:00+01:00'),
      ev('wake_up', '2026-07-06T07:00:00+01:00'),
      ev('caffeine', '2026-07-06T08:00:00+01:00'),
    ];
    const win = wakeWindowEvents(events, NOW);
    expect(win.map((e) => e.occurredAt)).toEqual([
      '2026-07-06T07:00:00+01:00',
      '2026-07-06T08:00:00+01:00',
    ]);
  });
});

describe('wakeWindowAt', () => {
  const events = [
    ev('sleep_start', '2026-07-03T23:00:00+01:00'),
    ev('wake_up', '2026-07-04T07:00:00+01:00'),
    ev('caffeine', '2026-07-04T09:00:00+01:00'),
    ev('sleep_start', '2026-07-04T23:30:00+01:00'),
    ev('wake_up', '2026-07-05T07:30:00+01:00'),
    ev('mood', '2026-07-05T12:00:00+01:00'),
    ev('sleep_start', '2026-07-05T23:41:00+01:00'),
    ev('wake_up', '2026-07-06T09:04:00+01:00'),
    ev('caffeine', '2026-07-06T10:00:00+01:00'),
  ];

  it('offset 0 matches wakeWindowEvents and carries the night pair', () => {
    const win = wakeWindowAt(events, NOW, 0);
    expect(win?.events).toEqual(wakeWindowEvents(events, NOW));
    expect(win?.anchor?.occurredAt).toBe('2026-07-06T09:04:00+01:00');
    expect(win?.pair?.start.occurredAt).toBe('2026-07-05T23:41:00+01:00');
  });

  it('offset 1 spans the previous wake up to (excluding) the next', () => {
    const win = wakeWindowAt(events, NOW, 1);
    expect(win?.events.map((e) => e.occurredAt)).toEqual([
      '2026-07-05T07:30:00+01:00',
      '2026-07-05T12:00:00+01:00',
      '2026-07-05T23:41:00+01:00',
    ]);
    expect(win?.anchor?.occurredAt).toBe('2026-07-05T07:30:00+01:00');
    expect(win?.pair?.start.occurredAt).toBe('2026-07-04T23:30:00+01:00');
  });

  it('returns null beyond recorded history', () => {
    expect(wakeWindowAt(events, NOW, 3)).toBeNull();
    expect(wakeWindowAt([], NOW, 1)).toBeNull();
  });

  it('offset 0 with no wake falls back to midnight and a null anchor', () => {
    const only = [ev('caffeine', '2026-07-06T08:00:00+01:00')];
    const win = wakeWindowAt(only, NOW, 0);
    expect(win?.anchor).toBeNull();
    expect(win?.events).toHaveLength(1);
  });
});

describe('missingNights', () => {
  it('flags the last three mornings without a complete pair', () => {
    const events = [
      ev('sleep_start', '2026-07-04T23:00:00+01:00'),
      ev('wake_up', '2026-07-05T07:00:00+01:00'),
    ];
    expect(missingNights(events, NOW)).toEqual(['2026-07-06', '2026-07-04']);
  });

  it('does not flag today while still asleep', () => {
    const events = [ev('sleep_start', '2026-07-06T01:00:00+01:00')];
    expect(missingNights(events, NOW)).not.toContain('2026-07-06');
  });
});

describe('looksLikeNap', () => {
  it('flags short pairs and daytime pairs', () => {
    const short = buildSleepPairs([
      ev('sleep_start', '2026-07-06T14:00:00+01:00'),
      ev('wake_up', '2026-07-06T15:30:00+01:00'),
    ])[0];
    expect(looksLikeNap(short)).toBe(true);

    const daytime = buildSleepPairs([
      ev('sleep_start', '2026-07-06T11:00:00+01:00'),
      ev('wake_up', '2026-07-06T16:30:00+01:00'),
    ])[0];
    expect(looksLikeNap(daytime)).toBe(true);

    const night = buildSleepPairs([
      ev('sleep_start', '2026-07-05T23:00:00+01:00'),
      ev('wake_up', '2026-07-06T07:00:00+01:00'),
    ])[0];
    expect(looksLikeNap(night)).toBe(false);
  });
});

describe('checkSleepSpan / overlapsPairs', () => {
  it('enforces ordering and the 20min–16h window', () => {
    expect(checkSleepSpan('2026-07-06T07:00:00+01:00', '2026-07-06T06:00:00+01:00').ok).toBe(false);
    expect(checkSleepSpan('2026-07-06T07:00:00+01:00', '2026-07-06T07:10:00+01:00').ok).toBe(false);
    expect(checkSleepSpan('2026-07-05T12:00:00+01:00', '2026-07-06T07:00:00+01:00').ok).toBe(false);
    expect(checkSleepSpan('2026-07-05T23:00:00+01:00', '2026-07-06T07:00:00+01:00').ok).toBe(true);
  });

  it('detects overlap with existing pairs, honoring exclusions', () => {
    const pairs = buildSleepPairs([
      ev('sleep_start', '2026-07-05T23:00:00+01:00'),
      ev('wake_up', '2026-07-06T07:00:00+01:00'),
    ]);
    expect(overlapsPairs(pairs, '2026-07-06T01:00:00+01:00', '2026-07-06T02:00:00+01:00')).toBe(true);
    expect(overlapsPairs(pairs, '2026-07-06T08:00:00+01:00', '2026-07-06T09:00:00+01:00')).toBe(false);
    const ids = [pairs[0].start.id, pairs[0].end.id];
    expect(overlapsPairs(pairs, '2026-07-06T01:00:00+01:00', '2026-07-06T02:00:00+01:00', ids)).toBe(false);
  });
});

describe('daySleepSpans', () => {
  const D = '2026-07-06';

  it('returns both sleeps when two happen in one day', () => {
    const events = [
      ev('sleep_start', '2026-07-06T01:00:00+01:00'),
      ev('wake_up', '2026-07-06T08:00:00+01:00'),
      ev('sleep_start', '2026-07-06T14:40:00+01:00'),
      ev('wake_up', '2026-07-06T15:04:00+01:00'),
    ];
    expect(daySleepSpans(events, D)).toEqual([
      { from: 60, to: 480 },
      { from: 880, to: 904 },
    ]);
  });

  it('clips a span that crosses midnight into the axis day', () => {
    const events = [
      ev('sleep_start', '2026-07-05T23:30:00+01:00'),
      ev('wake_up', '2026-07-06T07:00:00+01:00'),
    ];
    expect(daySleepSpans(events, D)).toEqual([{ from: 0, to: 420 }]);
    expect(daySleepSpans(events, '2026-07-05', 24 * 60)).toEqual([
      { from: 23 * 60 + 30, to: 24 * 60 },
    ]);
  });

  it('paints a wake without a start marker from midnight', () => {
    const events = [ev('wake_up', '2026-07-06T07:00:00+01:00')];
    expect(daySleepSpans(events, D)).toEqual([{ from: 0, to: 420 }]);
    expect(daySleepSpans(events, '2026-07-05')).toEqual([]);
  });

  it('ends an open sleep at endOfDayMin (now) on the current day', () => {
    const events = [ev('sleep_start', '2026-07-06T22:00:00+01:00')];
    expect(daySleepSpans(events, D, 23 * 60)).toEqual([{ from: 22 * 60, to: 23 * 60 }]);
  });

  it('ignores sleeps entirely outside the axis day', () => {
    const events = [
      ev('sleep_start', '2026-07-04T23:00:00+01:00'),
      ev('wake_up', '2026-07-05T07:00:00+01:00'),
      ev('sleep_start', '2026-07-07T01:00:00+01:00'),
      ev('wake_up', '2026-07-07T08:00:00+01:00'),
    ];
    expect(daySleepSpans(events, D)).toEqual([]);
  });
});
