import { describe, expect, it } from 'vitest';
import { formatClock } from './clockStats';
import { buildDayRows } from './days';
import { buildEpisodes, dayRange } from './episodes';
import {
  recordRange,
  sleepRegularityIndex,
  summariseConfidence,
  summariseFragmentation,
  summariseIntake,
  summariseSleep,
} from './summary';
import type { AppEvent, EventType } from '../types';

/** The store returns a `synthetic` precision that the writable `Precision`
 *  union deliberately excludes, so fixtures have to be able to say it. */
type EventOverrides = Partial<Omit<AppEvent, 'precision'>> & { precision?: string };
import type { NapRecord, SleepEpisode, TimedPoint } from './types';

let seq = 0;
function ev(type: EventType, occurredAt: string, extra: EventOverrides = {}): AppEvent {
  seq += 1;
  return {
    id: `s${seq}`,
    type,
    category: type === 'sleep_start' || type === 'wake_up' ? 'marker' : 'action',
    occurredAt,
    precision: 'exact',
    ...extra,
  } as AppEvent;
}

const night = (s: string, e: string, extra: EventOverrides = {}) => [
  ev('sleep_start', s, extra),
  ev('wake_up', e, extra),
];

const point = (dayKey: string, minutes: number): TimedPoint => ({
  atIso: `${dayKey}T00:00:00+01:00`,
  dayKey,
  minutes,
  label: '',
});

describe('summariseSleep', () => {
  const episodes = buildEpisodes([
    ...night('2026-07-27T23:00:00+01:00', '2026-07-28T07:00:00+01:00'), // 8h
    ...night('2026-07-29T01:00:00+01:00', '2026-07-29T07:00:00+01:00'), // 6h
  ]);

  it('counts one night per main sleep', () => {
    expect(summariseSleep(buildDayRows(episodes, 'night')).days).toBe(2);
  });

  it('averages onsets across midnight', () => {
    const onset = summariseSleep(buildDayRows(episodes, 'night')).onset;
    expect(formatClock((onset as NonNullable<typeof onset>).meanMinutes)).toBe('00:00');
  });

  it('averages duration in minutes', () => {
    expect(summariseSleep(buildDayRows(episodes, 'night')).meanTotalMinutes).toBe(420);
  });

  it('reports the longest and shortest night', () => {
    const s = summariseSleep(buildDayRows(episodes, 'night'));
    expect(s.longestTotalMinutes).toBe(480);
    expect(s.shortestTotalMinutes).toBe(360);
  });

  it('counts onsets at or after 03:00 as late', () => {
    const late = buildEpisodes(night('2026-07-30T04:00:00+01:00', '2026-07-30T10:00:00+01:00'));
    expect(summariseSleep(buildDayRows(late, 'night')).lateOnsetDays).toBe(1);
  });

  it('does not count a pre-midnight onset as late', () => {
    const early = buildEpisodes(night('2026-07-30T22:00:00+01:00', '2026-07-31T06:00:00+01:00'));
    expect(summariseSleep(buildDayRows(early, 'night')).lateOnsetDays).toBe(0);
  });

  it('handles an empty record', () => {
    const s = summariseSleep([]);
    expect(s.days).toBe(0);
    expect(s.onset).toBeNull();
    expect(s.meanTotalMinutes).toBeNull();
  });

  it('counts fragments in the total but not in the main-episode average', () => {
    const withFragment = buildEpisodes([
      ...night('2026-07-30T00:00:00+01:00', '2026-07-30T08:00:00+01:00'), // main 8h
      ...night('2026-07-30T09:00:00+01:00', '2026-07-30T10:00:00+01:00'), // fragment 1h
    ]);
    const s = summariseSleep(buildDayRows(withFragment, 'night'));
    expect(s.meanTotalMinutes).toBe(540);
    expect(s.meanMainMinutes).toBe(480);
  });

  /** The exact shape that made the report look like it invented a night. */
  it('keeps a small-hours onset on the night it began, and counts the whole night', () => {
    const fragmentedNight = buildEpisodes([
      ...night('2026-08-02T00:07:00+01:00', '2026-08-02T05:01:00+01:00'), // 4h54
      ...night('2026-08-02T05:34:00+01:00', '2026-08-02T12:11:00+01:00'), // 6h37
    ]);
    const rows = buildDayRows(fragmentedNight, 'night');
    expect(rows).toHaveLength(1);
    expect(rows[0].dayKey).toBe('2026-08-01');
    expect(summariseSleep(rows).meanTotalMinutes).toBe(294 + 397);
    expect(summariseSleep(rows).meanMainMinutes).toBe(397);
  });
});

describe('summariseFragmentation', () => {
  it('counts days holding more than one episode', () => {
    const episodes = buildEpisodes([
      ...night('2026-07-30T00:31:00+01:00', '2026-07-30T06:02:00+01:00'),
      ...night('2026-07-30T07:31:00+01:00', '2026-07-30T12:10:00+01:00'),
    ]);
    expect(summariseFragmentation(buildDayRows(episodes, 'night'), episodes, []).fragmentedDays).toBe(1);
  });

  it('flags a short evening sleep', () => {
    const episodes = buildEpisodes(night('2026-07-28T19:00:00+01:00', '2026-07-28T22:00:00+01:00'));
    expect(summariseFragmentation(buildDayRows(episodes, 'night'), episodes, []).eveningEpisodes).toBe(1);
  });

  it('does not flag a full night that starts in the evening', () => {
    const episodes = buildEpisodes(night('2026-07-28T21:00:00+01:00', '2026-07-29T06:00:00+01:00'));
    expect(summariseFragmentation(buildDayRows(episodes, 'night'), episodes, []).eveningEpisodes).toBe(0);
  });

  it('averages nap length over naps that have one', () => {
    const naps: NapRecord[] = [
      { atIso: '', dayKey: '2026-07-10', startMinutes: 0, durationMinutes: 40, confidence: 'logged' },
      { atIso: '', dayKey: '2026-07-11', startMinutes: 0, durationMinutes: 80, confidence: 'logged' },
      { atIso: '', dayKey: '2026-07-12', startMinutes: 0, durationMinutes: null, confidence: 'logged' },
    ];
    const f = summariseFragmentation([], [], naps);
    expect(f.naps).toBe(3);
    expect(f.meanNapMinutes).toBe(60);
  });
});

describe('summariseIntake', () => {
  it('counts late caffeine at or after 15:00', () => {
    const s = summariseIntake(
      [point('2026-07-30', 14 * 60 + 59), point('2026-07-30', 15 * 60)],
      [],
      [],
    );
    expect(s.caffeineDoses).toBe(2);
    expect(s.caffeineLate).toBe(1);
  });

  it('counts overnight meals before 07:00', () => {
    const s = summariseIntake([], [point('2026-07-29', 3 * 60 + 48), point('2026-07-29', 13 * 60)], [
      '2026-07-29',
    ]);
    expect(s.meals).toBe(2);
    expect(s.nightMeals).toBe(1);
  });

  it('averages meals over days that actually have meal data', () => {
    const s = summariseIntake(
      [],
      [point('2026-07-29', 600), point('2026-07-29', 700), point('2026-07-30', 600)],
      ['2026-07-29', '2026-07-29', '2026-07-30'],
    );
    expect(s.mealDaysCovered).toBe(2);
    expect(s.meanMealsPerDay).toBe(1.5);
  });

  it('returns a null average with no meal days', () => {
    expect(summariseIntake([], [], []).meanMealsPerDay).toBeNull();
  });
});

describe('summariseConfidence', () => {
  it('tallies each tier', () => {
    const episodes = buildEpisodes([
      ...night('2026-04-14T23:30:00+00:00', '2026-04-15T07:30:00+00:00', { precision: 'synthetic' }),
      ...night('2026-05-20T23:00:00+00:00', '2026-05-21T07:00:00+00:00', { precision: '~hour' }),
      ...night('2026-07-30T00:31:00+01:00', '2026-07-30T06:02:00+01:00'),
    ]);
    expect(summariseConfidence(episodes)).toEqual({
      logged: 1,
      approximate: 1,
      reconstructed: 1,
    });
  });
});

describe('sleepRegularityIndex', () => {
  function nightsAt(startHour: number, days: number, fromDay: number): AppEvent[] {
    const out: AppEvent[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = String(fromDay + i).padStart(2, '0');
      const next = String(fromDay + i + 1).padStart(2, '0');
      const h = String(startHour).padStart(2, '0');
      out.push(
        ev('sleep_start', `2026-07-${d}T${h}:00:00+01:00`),
        ev('wake_up', `2026-07-${next}T07:00:00+01:00`),
      );
    }
    return out;
  }

  it('scores an identical schedule high', () => {
    const keys = dayRange('2026-07-01', '2026-07-11');
    const result = sleepRegularityIndex(buildEpisodes(nightsAt(23, 10, 1)), new Set(keys), keys);
    expect(result.sri as number).toBeGreaterThan(90);
  });

  it('penalises only the unpaired first morning, so longer records score higher', () => {
    // The first tracked day has no night before it, so its 00:00-07:00 is
    // discordant by construction. That edge dilutes as the record grows —
    // a ceiling below 100 on a short record is correct, not a defect.
    const short = dayRange('2026-07-01', '2026-07-06');
    const long = dayRange('2026-07-01', '2026-07-21');
    const shortSri = sleepRegularityIndex(buildEpisodes(nightsAt(23, 5, 1)), new Set(short), short);
    const longSri = sleepRegularityIndex(buildEpisodes(nightsAt(23, 20, 1)), new Set(long), long);
    expect(longSri.sri as number).toBeGreaterThan(shortSri.sri as number);
  });

  it('scores an inverted schedule far below a regular one', () => {
    const regular = sleepRegularityIndex(
      buildEpisodes(nightsAt(23, 4, 1)),
      new Set(dayRange('2026-07-01', '2026-07-05')),
      dayRange('2026-07-01', '2026-07-05'),
    );
    const shifting = buildEpisodes([
      ...night('2026-07-01T23:00:00+01:00', '2026-07-02T07:00:00+01:00'),
      ...night('2026-07-02T12:00:00+01:00', '2026-07-02T20:00:00+01:00'),
      ...night('2026-07-03T23:00:00+01:00', '2026-07-04T07:00:00+01:00'),
      ...night('2026-07-04T12:00:00+01:00', '2026-07-04T20:00:00+01:00'),
    ]);
    const keys = dayRange('2026-07-01', '2026-07-05');
    const irregular = sleepRegularityIndex(shifting, new Set(keys), keys);
    expect(irregular.sri as number).toBeLessThan(regular.sri as number);
  });

  it('excludes untracked days instead of scoring them as awake', () => {
    const episodes = buildEpisodes(nightsAt(23, 2, 1));
    const keys = dayRange('2026-07-01', '2026-07-10');
    const coveredOnly = new Set(['2026-07-01', '2026-07-02', '2026-07-03']);
    const withGap = sleepRegularityIndex(episodes, coveredOnly, keys);
    const naive = sleepRegularityIndex(episodes, new Set(keys), keys);
    // The naive version is inflated by the empty tail reading as "awake".
    expect(withGap.comparisons).toBeLessThan(naive.comparisons);
    expect(naive.sri as number).toBeGreaterThan(withGap.sri as number);
  });

  it('returns null when nothing can be compared', () => {
    expect(sleepRegularityIndex([], new Set(), []).sri).toBeNull();
    expect(sleepRegularityIndex([], new Set(), ['2026-07-01']).sri).toBeNull();
  });
});

describe('recordRange', () => {
  it('spans first to last day inclusive', () => {
    const r = recordRange(['2026-07-30', '2026-07-28', '2026-07-29']);
    expect(r).not.toBeNull();
    expect((r as NonNullable<typeof r>).fromKey).toBe('2026-07-28');
    expect((r as NonNullable<typeof r>).toKey).toBe('2026-07-30');
    expect((r as NonNullable<typeof r>).keys).toHaveLength(3);
  });

  it('returns null with no days', () => {
    expect(recordRange([])).toBeNull();
  });
});

describe('episode typing', () => {
  it('exposes the fields the report renders', () => {
    const e: SleepEpisode = buildEpisodes(
      night('2026-07-30T00:31:00+01:00', '2026-07-30T06:02:00+01:00'),
    )[0];
    expect(Object.keys(e).sort()).toEqual(
      [
        'confidence',
        'dayKey',
        'durationMinutes',
        'endIso',
        'endMinutes',
        'kind',
        'startIso',
        'startMinutes',
      ].sort(),
    );
  });
});
