import { describe, expect, it } from 'vitest';
import { buildMatrixRows, buildWeekCharts } from './weekCharts';
import { CATEGORY_BY_TYPE, type AppEvent, type EventType } from './types';

const TZ = '+01:00';
const TODAY = '2026-07-12';
let seq = 0;

function ev(type: EventType, at: string, extra: Partial<AppEvent> = {}): AppEvent {
  return {
    id: `t-${seq++}`,
    type,
    category: CATEGORY_BY_TYPE[type],
    occurredAt: `${at}${TZ}`,
    precision: 'exact',
    ...extra,
  };
}

/**
 * A night waking on `dayKey`. An evening bedtime lands on the previous day;
 * an after-midnight one lands on the wake day.
 */
function night(dayKey: string, bedHour: number, wakeHour: number): AppEvent[] {
  const hh = (n: number) => String(n).padStart(2, '0');
  let bedKey = dayKey;
  if (bedHour >= 12) {
    const prev = new Date(`${dayKey}T00:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    bedKey = prev.toISOString().slice(0, 10);
  }
  return [
    ev('sleep_start', `${bedKey}T${hh(bedHour)}:00:00`),
    ev('wake_up', `${dayKey}T${hh(wakeHour)}:00:00`),
  ];
}

describe('buildWeekCharts', () => {
  it('returns seven ascending days ending today', () => {
    const w = buildWeekCharts([], TODAY);
    expect(w.dayKeys).toHaveLength(7);
    expect(w.dayKeys[6]).toBe(TODAY);
    expect(w.todayIndex).toBe(6);
  });

  it('leaves an unlogged night null rather than zero', () => {
    const w = buildWeekCharts([], TODAY);
    expect(w.sleep.every((p) => p.value === null)).toBe(true);
    expect(w.sleep.every((p) => p.state === 'none')).toBe(true);
  });

  it('scores a night against the band and names the shortfall', () => {
    const w = buildWeekCharts(night(TODAY, 1, 6), TODAY);
    const today = w.sleep[6];
    expect(today.value).toBe(5 * 60);
    expect(today.state).toBe('bad');
    expect(today.tip.verdict).toBe('2h 00m below your range');
  });

  it('flags a long night as a deviation, not a win', () => {
    const w = buildWeekCharts(night(TODAY, 21, 8), TODAY);
    expect(w.sleep[6].value).toBe(11 * 60);
    expect(w.sleep[6].state).toBe('bad');
    expect(w.sleep[6].tip.verdict).toBe('2h 00m above your range');
  });

  it('puts bed and wake times in the tooltip so the ledger is not needed', () => {
    const w = buildWeekCharts(night(TODAY, 23, 7), TODAY);
    expect(w.sleep[6].tip.rows).toEqual([
      { k: 'Asleep', v: '23:00' },
      { k: 'Woke', v: '07:00' },
    ]);
  });

  it('adds the day’s last caffeine to the sleep tooltip as an aligned observation', () => {
    const events = [...night(TODAY, 23, 7), ev('caffeine', `${TODAY}T16:50:00`)];
    const w = buildWeekCharts(events, TODAY);
    expect(w.sleep[6].tip.rows).toContainEqual({ k: 'Last caffeine', v: '16:50' });
  });

  it('separates a day with no meals from a day that really scored zero', () => {
    const noMeals = buildWeekCharts([], TODAY);
    expect(noMeals.protein[6].value).toBeNull();
    expect(noMeals.protein[6].state).toBe('none');

    const zeroProtein = buildWeekCharts([ev('meal', `${TODAY}T12:00:00`, { proteinG: 0 })], TODAY);
    expect(zeroProtein.protein[6].value).toBe(0);
    expect(zeroProtein.protein[6].state).toBe('bad');
  });

  it('sums protein across the day and counts its meals', () => {
    const events = [
      ev('meal', `${TODAY}T08:00:00`, { proteinG: 40 }),
      ev('meal', `${TODAY}T13:00:00`, { proteinG: 55 }),
    ];
    const w = buildWeekCharts(events, TODAY);
    expect(w.protein[6].value).toBe(95);
    expect(w.protein[6].tip.rows).toEqual([{ k: 'Meals', v: '2' }]);
    expect(w.protein[6].tip.verdict).toBe('65g short of 160g');
  });

  it('gives mood no verdict, because there is no goal for it', () => {
    const w = buildWeekCharts([ev('mood', `${TODAY}T10:00:00`, { intensity: 4 })], TODAY);
    expect(w.mood[6].state).toBe('neutral');
    expect(w.mood[6].tip.verdict).toBe('');
  });

  it('collects caffeine times per day in order', () => {
    const events = [
      ev('caffeine', `${TODAY}T17:40:00`),
      ev('caffeine', `${TODAY}T08:00:00`),
    ];
    const w = buildWeekCharts(events, TODAY);
    expect(w.caffeine[6].minutes).toEqual([8 * 60, 17 * 60 + 40]);
    expect(w.caffeine[6].last).toBe('17:40');
  });
});

describe('buildMatrixRows', () => {
  const rowsFor = (events: AppEvent[]) => {
    const rows = buildMatrixRows(buildWeekCharts(events, TODAY));
    return Object.fromEntries(rows.map((r) => [r.label, r]));
  };

  it('has one row per tracker, seven cells each', () => {
    const rows = buildMatrixRows(buildWeekCharts([], TODAY));
    expect(rows.map((r) => r.label)).toEqual(['Sleep', 'Protein', 'Caffeine', 'Gym', 'Mood']);
    expect(rows.every((r) => r.states.length === 7 && r.titles.length === 7)).toBe(true);
  });

  it('treats no caffeine at all as meeting both caffeine goals', () => {
    expect(rowsFor([]).Caffeine.states[6]).toBe('goal');
  });

  it('flags being past the cutoff', () => {
    expect(rowsFor([ev('caffeine', `${TODAY}T17:40:00`)]).Caffeine.states[6]).toBe('over');
  });

  it('flags too many in a day even when all are early', () => {
    const four = Array.from({ length: 4 }, (_, i) =>
      ev('caffeine', `${TODAY}T0${7 + i}:00:00`),
    );
    expect(rowsFor(four).Caffeine.states[6]).toBe('over');
  });

  it('takes the worse of the two caffeine goals', () => {
    const events = [
      ...Array.from({ length: 4 }, (_, i) => ev('caffeine', `${TODAY}T0${7 + i}:00:00`)),
      ev('caffeine', `${TODAY}T19:05:00`),
    ];
    // Five intakes is 'over' on count; 19:05 is 'bad' on time. Worse wins.
    expect(rowsFor(events).Caffeine.states[6]).toBe('bad');
  });

  it('never scores today’s unfinished protein as a miss', () => {
    const rows = rowsFor([ev('meal', `${TODAY}T08:00:00`, { proteinG: 30 })]);
    expect(rows.Protein.states[6]).toBe('partial');
  });

  it('still scores today’s protein as met once the floor is reached', () => {
    const rows = rowsFor([ev('meal', `${TODAY}T08:00:00`, { proteinG: 180 })]);
    expect(rows.Protein.states[6]).toBe('goal');
  });

  it('reads gym as presence', () => {
    const rows = rowsFor([ev('gym-session', `${TODAY}T18:00:00`)]);
    expect(rows.Gym.states[6]).toBe('goal');
    expect(rows.Gym.states[0]).toBe('none');
  });

  it('gives every cell a sentence for assistive tech', () => {
    const rows = rowsFor([]);
    expect(rows.Sleep.titles[6]).toContain('Sleep');
    expect(rows.Sleep.titles[6]).toContain('not logged');
  });
});
