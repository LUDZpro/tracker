import { describe, expect, it } from 'vitest';
import { actogramTicks, buildActogram } from './actogram';
import { buildEpisodes, dayRange } from './episodes';
import type { AppEvent, EventType } from '../types';

/** The store returns a `synthetic` precision that the writable `Precision`
 *  union deliberately excludes, so fixtures have to be able to say it. */
type EventOverrides = Partial<Omit<AppEvent, 'precision'>> & { precision?: string };

let seq = 0;
function ev(type: EventType, occurredAt: string, extra: EventOverrides = {}): AppEvent {
  seq += 1;
  return {
    id: `a${seq}`,
    type,
    category: 'marker',
    occurredAt,
    precision: 'exact',
    ...extra,
  } as AppEvent;
}
const night = (s: string, e: string, extra: EventOverrides = {}) => [
  ev('sleep_start', s, extra),
  ev('wake_up', e, extra),
];

const KEYS = dayRange('2026-07-28', '2026-07-31');
const ALL = new Set(KEYS);

describe('buildActogram', () => {
  it('returns one row per day in the range', () => {
    const rows = buildActogram([], KEYS, ALL);
    expect(rows.map((r) => r.dayKey)).toEqual(KEYS);
  });

  it('places an overnight sleep on the row of the evening it started', () => {
    const episodes = buildEpisodes(night('2026-07-28T23:00:00+01:00', '2026-07-29T07:00:00+01:00'));
    const rows = buildActogram(episodes, KEYS, ALL);
    const row = rows.find((r) => r.dayKey === '2026-07-28');
    // 23:00 is 11h after the noon anchor; the span runs 8h from there.
    expect(row?.spans).toEqual([
      { from: 660, to: 1140, kind: 'main', confidence: 'logged' },
    ]);
    expect(rows.find((r) => r.dayKey === '2026-07-29')?.spans).toEqual([]);
  });

  it('splits an episode that crosses the noon boundary across two rows', () => {
    const episodes = buildEpisodes(night('2026-07-29T10:00:00+01:00', '2026-07-29T14:00:00+01:00'));
    const rows = buildActogram(episodes, KEYS, ALL);
    const before = rows.find((r) => r.dayKey === '2026-07-28');
    const after = rows.find((r) => r.dayKey === '2026-07-29');
    // 10:00-12:00 lands at the end of the previous noon-to-noon window.
    expect(before?.spans).toEqual([{ from: 1320, to: 1440, kind: 'main', confidence: 'logged' }]);
    // 12:00-14:00 opens the next one.
    expect(after?.spans).toEqual([{ from: 0, to: 120, kind: 'main', confidence: 'logged' }]);
  });

  it('keeps two episodes of one night as separate spans', () => {
    const episodes = buildEpisodes([
      ...night('2026-07-29T00:31:00+01:00', '2026-07-29T06:02:00+01:00'),
      ...night('2026-07-29T07:31:00+01:00', '2026-07-29T10:10:00+01:00'),
    ]);
    const row = buildActogram(episodes, KEYS, ALL).find((r) => r.dayKey === '2026-07-28');
    expect(row?.spans).toHaveLength(2);
    expect(row?.spans.map((s) => s.kind)).toEqual(['main', 'fragment']);
  });

  it('carries the confidence tier through to the span', () => {
    const episodes = buildEpisodes(
      night('2026-07-28T23:00:00+01:00', '2026-07-29T07:00:00+01:00', { precision: 'synthetic' }),
    );
    const row = buildActogram(episodes, KEYS, ALL).find((r) => r.dayKey === '2026-07-28');
    expect(row?.spans[0].confidence).toBe('reconstructed');
  });

  it('marks days outside the covered set', () => {
    const rows = buildActogram([], KEYS, new Set(['2026-07-28']));
    expect(rows.map((r) => r.covered)).toEqual([true, false, false, false]);
  });

  it('ignores an episode outside the range', () => {
    const episodes = buildEpisodes(night('2026-06-01T23:00:00+01:00', '2026-06-02T07:00:00+01:00'));
    expect(buildActogram(episodes, KEYS, ALL).every((r) => r.spans.length === 0)).toBe(true);
  });

  it('never emits a span wider than its row', () => {
    const episodes = buildEpisodes(night('2026-07-28T13:00:00+01:00', '2026-07-29T03:00:00+01:00'));
    for (const row of buildActogram(episodes, KEYS, ALL)) {
      for (const s of row.spans) {
        expect(s.from).toBeGreaterThanOrEqual(0);
        expect(s.to).toBeLessThanOrEqual(1440);
        expect(s.to).toBeGreaterThan(s.from);
      }
    }
  });
});

describe('actogramTicks', () => {
  it('starts and ends at the anchor hour', () => {
    const ticks = actogramTicks();
    expect(ticks[0]).toEqual({ atMinutes: 0, label: '12' });
    expect(ticks[ticks.length - 1]).toEqual({ atMinutes: 1440, label: '12' });
  });

  it('wraps past midnight', () => {
    expect(actogramTicks().map((t) => t.label)).toEqual([
      '12', '15', '18', '21', '00', '03', '06', '09', '12',
    ]);
  });

  it('honours a custom interval', () => {
    expect(actogramTicks(6).map((t) => t.label)).toEqual(['12', '18', '00', '06', '12']);
  });
});
